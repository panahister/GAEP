/// <reference lib="dom" />

import {
  isStudioAction,
  parseHostToStudioMessage,
  runStageLabels,
  studioProtocolVersion,
  studioRouteLabels,
  studioRoutes,
  type AgentPageSnapshot,
  type CompletionState,
  type DeliveryPageSnapshot,
  type HostToStudioMessage,
  type OverviewPageSnapshot,
  type ReadinessPageSnapshot,
  type RecordFormPageSnapshot,
  type RisksDecisionsPageSnapshot,
  type RunPageSnapshot,
  type StudioAction,
  type StudioActionControl,
  type StudioDefinitionEntry,
  type DesignFieldState,
  type StudioDesignSectionSnapshot,
  type StudioFieldSnapshot,
  type StudioInspectorSnapshot,
  type StudioIssue,
  type StudioPageBase,
  type StudioRoute,
  type StudioSnapshot,
  type StudioSurfaceState,
  type StudioTableSnapshot,
  type StudioToHostMessage,
  type TracePageSnapshot,
} from "./studio-protocol.js"

interface VsCodeWebviewApi<State> {
  postMessage(message: unknown): void
  getState(): State | undefined
  setState(state: State): void
}

interface StudioClientState {
  route?: StudioRoute
}

declare function acquireVsCodeApi<State = unknown>(): VsCodeWebviewApi<State>

const completionLabels: Readonly<Record<CompletionState, string>> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  complete: "Complete",
  blocked: "Blocked",
  invalid: "Invalid",
}

const completionIcons: Readonly<Record<CompletionState, string>> = {
  "not-started": "circle-outline",
  "in-progress": "sync",
  complete: "pass",
  blocked: "error",
  invalid: "warning",
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function sourceText(page: StudioPageBase): string {
  const parts = [page.source.provenance]
  if (page.source.sourceRevision !== undefined) parts.push(`Revision ${page.source.sourceRevision}`)
  if (page.source.freshness) parts.push(page.source.freshness)
  return parts.join(" · ")
}

type WithoutStudioEnvelope<T> = T extends unknown ? Omit<T, "protocolVersion" | "channelId"> : never
type StudioToHostPayload = WithoutStudioEnvelope<StudioToHostMessage>

class HostBridge {
  private readonly api = acquireVsCodeApi<StudioClientState>()
  private readonly listeners = new Set<(message: HostToStudioMessage) => void>()

  constructor(readonly channelId: string) {
    window.addEventListener("message", (event: MessageEvent<unknown>) => {
      const message = parseHostToStudioMessage(event.data, this.channelId)
      if (!message) return
      for (const listener of this.listeners) listener(message)
    })
  }

  onMessage(listener: (message: HostToStudioMessage) => void): void {
    this.listeners.add(listener)
  }

  post(message: StudioToHostPayload): void {
    this.api.postMessage({
      ...message,
      protocolVersion: studioProtocolVersion,
      channelId: this.channelId,
    })
  }

  getState(): StudioClientState | undefined {
    return this.api.getState()
  }

  setRoute(route: StudioRoute): void {
    this.api.setState({ route })
  }
}

class StudioShell {
  private snapshot?: StudioSnapshot
  private previousRoute?: StudioRoute
  private draftValues = new Map<string, string | string[]>()
  private draftStates = new Map<string, DesignFieldState>()
  private deferredReasons = new Map<string, string>()
  private revisitTriggers = new Map<string, string>()
  private draftDirty = false
  private readonly sortState = new Map<string, { key: string; direction: "ascending" | "descending" }>()

  constructor(
    private readonly root: HTMLElement,
    private readonly politeLive: HTMLElement,
    private readonly assertiveLive: HTMLElement,
    private readonly bridge: HostBridge,
  ) {
    this.bridge.onMessage((message) => this.receive(message))
    window.addEventListener("keydown", (event) => this.handleGlobalKey(event))
  }

  start(restoredRoute?: StudioRoute): void {
    this.bridge.post({ type: "studio.ready", restoredRoute })
  }

  private receive(message: HostToStudioMessage): void {
    switch (message.type) {
      case "studio.snapshot":
        this.applySnapshot(message.snapshot)
        break
      case "studio.action-result":
        this.announce(message.result.announcement, message.result.status === "rejected" ? "assertive" : "polite")
        if (message.snapshot && message.result.status === "accepted") this.applySnapshot(message.snapshot)
        if (message.result.focusFieldId) {
          requestAnimationFrame(() => {
            const fieldId = message.result.focusFieldId!
            const target = document.getElementById(`studio-field-${fieldId}`) ?? document.getElementById(fieldId)
            target?.focus()
          })
        }
        break
      case "studio.focus-route":
        if (this.snapshot?.route === message.route) this.focusPageHeading()
        break
      case "studio.announce":
        this.announce(message.message, message.priority)
        break
    }
  }

  private applySnapshot(snapshot: StudioSnapshot): void {
    const routeChanged = this.snapshot?.route !== snapshot.route
    this.snapshot = snapshot
    this.bridge.setRoute(snapshot.route)
    this.draftValues.clear()
    this.draftStates.clear()
    this.deferredReasons.clear()
    this.revisitTriggers.clear()
    const fields = snapshot.page.design?.fields ?? (snapshot.page.kind === "record-form" ? snapshot.page.fields : [])
    if (fields.length > 0) {
      for (const field of fields) {
        this.draftValues.set(field.id, Array.isArray(field.value) ? [...field.value] : field.value)
        if (field.designState) this.draftStates.set(field.id, field.designState)
        if (field.deferredReason) this.deferredReasons.set(field.id, field.deferredReason)
        if (field.revisitTrigger) this.revisitTriggers.set(field.id, field.revisitTrigger)
      }
    }
    this.draftDirty = false
    this.render(routeChanged)
  }

  private render(focusRoute: boolean): void {
    const snapshot = this.snapshot
    if (!snapshot) return
    const shell = element("div", "studio-shell")
    shell.append(this.renderRail(snapshot), this.renderMobileNavigation(snapshot))

    const workspace = element("div", snapshot.inspector ? "studio-workspace with-inspector" : "studio-workspace")
    const main = element("main", "studio-main")
    main.id = "studio-main"
    main.tabIndex = -1
    if (snapshot.surface.kind === "ready") main.append(this.renderPage(snapshot))
    else main.append(this.renderSurfaceState(snapshot.surface))
    workspace.append(main)
    if (snapshot.inspector) workspace.append(this.renderInspector(snapshot.inspector))
    shell.append(workspace, this.renderFooter(snapshot))
    this.root.replaceChildren(shell)
    this.root.setAttribute("aria-busy", "false")
    if (focusRoute || this.previousRoute !== snapshot.route) requestAnimationFrame(() => this.focusPageHeading())
    this.previousRoute = snapshot.route
  }

  private renderRail(snapshot: StudioSnapshot): HTMLElement {
    const rail = element("aside", "studio-rail")
    const title = element("h1", "studio-name", "GAEP Product Studio")
    const nav = element("nav", "studio-nav")
    nav.setAttribute("aria-label", "Product Studio sections")
    for (const route of studioRoutes) {
      const state = snapshot.navigation.find((item) => item.route === route)
      if (!state) continue
      const button = element("button")
      button.type = "button"
      if (route === snapshot.route) button.setAttribute("aria-current", "page")
      const icon = element("span", `codicon codicon-${completionIcons[state.state]}`)
      icon.setAttribute("aria-hidden", "true")
      const copy = element("span", "nav-copy")
      copy.append(
        element("span", "nav-label", studioRouteLabels[route]),
        element("span", "nav-state", `${completionLabels[state.state]} · ${state.gapCount} gap${state.gapCount === 1 ? "" : "s"}`),
      )
      button.append(icon, copy)
      button.addEventListener("click", () => this.navigate(route))
      nav.append(button)
    }
    rail.append(title, nav)
    return rail
  }

  private renderMobileNavigation(snapshot: StudioSnapshot): HTMLElement {
    const wrapper = element("div", "studio-mobile-nav")
    const label = element("label", undefined, "GAEP Product Studio")
    label.htmlFor = "studio-route-select"
    const select = element("select")
    select.id = "studio-route-select"
    for (const route of studioRoutes) {
      const state = snapshot.navigation.find((item) => item.route === route)
      if (!state) continue
      const option = element("option")
      option.value = route
      option.selected = route === snapshot.route
      option.textContent = `${studioRouteLabels[route]} — ${completionLabels[state.state]}, ${state.gapCount} gap${state.gapCount === 1 ? "" : "s"}`
      select.append(option)
    }
    select.addEventListener("change", () => this.navigate(select.value as StudioRoute))
    wrapper.append(label, select)
    return wrapper
  }

  private navigate(route: StudioRoute): void {
    if (route === this.snapshot?.route) return
    if (!this.confirmDiscardDraft()) return
    this.root.setAttribute("aria-busy", "true")
    this.bridge.post({ type: "studio.navigate", route })
  }

  private renderPage(snapshot: StudioSnapshot): HTMLElement {
    switch (snapshot.page.kind) {
      case "overview":
        return this.renderOverview(snapshot.page)
      case "record-form":
        return this.renderRecordForm(snapshot.page)
      case "delivery":
        return this.renderDelivery(snapshot.page)
      case "risks-decisions":
        return this.renderRisksDecisions(snapshot.page)
      case "trace":
        return this.renderTrace(snapshot.page)
      case "agents-tools":
        return this.renderAgents(snapshot.page)
      case "runs-evidence":
        return this.renderRuns(snapshot.page)
      case "readiness":
        return this.renderReadiness(snapshot.page)
    }
  }

  private renderPageHeader(page: StudioPageBase): HTMLElement {
    const header = element("header", "page-header")
    const title = element("h2", undefined, page.title)
    title.id = "studio-page-title"
    title.tabIndex = -1
    header.append(title, element("p", "page-purpose", page.purpose), element("div", "source-line", sourceText(page)))
    if (page.actions.length > 0) header.append(this.renderActionRow(page.actions))
    return header
  }

  private renderOverview(page: OverviewPageSnapshot): HTMLElement {
    const container = element("div")
    const header = element("header", "page-header")
    const title = element("h2", undefined, page.product.name)
    title.id = "studio-page-title"
    title.tabIndex = -1
    const revision = page.product.revision === undefined ? page.product.lifecycle : `${page.product.lifecycle} · Revision ${page.product.revision}`
    header.append(title, element("div", "source-line", revision), element("p", "page-purpose", page.product.readinessStatement))
    if (page.primaryAction) {
      const primary = element("div", "primary-action")
      primary.append(this.renderActionButton(page.primaryAction))
      header.append(primary)
    }
    container.append(header)
    if (page.design) container.append(this.renderDesignSection(page.design, page.route))

    const progress = element("section", "section")
    progress.append(element("h3", undefined, "Design sections"))
    const list = element("ul", "progress-list")
    for (const section of page.sections) {
      const row = element("li", "progress-row")
      const summary = element("div")
      summary.append(
        element("strong", undefined, studioRouteLabels[section.route]),
        element("div", "muted", `${completionLabels[section.state]} · ${section.gapCount} gap${section.gapCount === 1 ? "" : "s"}`),
      )
      const open = element("button", "secondary", "Open")
      open.type = "button"
      open.addEventListener("click", () => this.navigate(section.route))
      row.append(summary, open)
      list.append(row)
    }
    progress.append(list)
    container.append(progress)

    const current = element("section", "section definition-columns")
    current.append(
      this.renderDefinitionGroup("Current Initiative", page.currentInitiative),
      this.renderDefinitionGroup("Latest run", page.latestRun),
    )
    container.append(current)
    if (page.blockers.length > 0) container.append(this.renderIssues("Blocking items", page.blockers))
    return container
  }

  private renderRecordForm(page: RecordFormPageSnapshot): HTMLElement {
    const container = element("div")
    container.append(this.renderPageHeader(page))
    if (page.design) {
      container.append(this.renderDesignSection(page.design, page.route))
      for (const table of page.relatedRecords ?? []) container.append(this.renderTable(table))
      return container
    }
    const fields = element("section", "section field-list")
    fields.setAttribute("aria-label", page.title)
    for (const field of page.fields) fields.append(this.renderField(page, field))
    container.append(fields)
    if (page.gaps.length > 0 || page.conflicts.length > 0) {
      const combined = [...page.gaps, ...page.conflicts]
      container.append(this.renderIssues("Known gaps and conflicts", combined))
    }
    const actions = element("section", "section action-row")
    actions.setAttribute("aria-label", "Draft and revision actions")
    const save = element("button", undefined, "Save draft")
    save.type = "button"
    save.addEventListener("click", () => this.perform({
      kind: "save-draft",
      route: page.route,
      recordId: page.recordId,
      draftId: page.draftId,
      baseRevision: page.baseRevision,
      values: Object.fromEntries(this.draftValues),
      states: Object.fromEntries(this.draftStates),
      deferredReasons: Object.fromEntries(this.deferredReasons),
      revisitTriggers: Object.fromEntries(this.revisitTriggers),
    }))
    const validate = element("button", "secondary", "Validate section")
    validate.type = "button"
    validate.addEventListener("click", () => this.perform({ kind: "validate-section", route: page.route, draftId: page.draftId }))
    const revision = element("button", "secondary", "Create revision")
    revision.type = "button"
    revision.disabled = !page.draft.materialChange || !page.draftId
    revision.title = revision.disabled ? "A saved material draft is required before a revision can be created." : "Create revision"
    revision.addEventListener("click", () => {
      if (!page.draftId) return
      this.perform({ kind: "create-revision", route: page.route, draftId: page.draftId, baseRevision: page.baseRevision })
    })
    actions.append(save, validate, revision)
    container.append(actions)
    return container
  }

  private renderField(page: RecordFormPageSnapshot, field: StudioFieldSnapshot): HTMLElement {
    const wrapper = element("div", "record-field")
    const label = element("label", "field-label", field.label)
    label.htmlFor = `studio-field-${field.id}`
    const control = element("div", "field-control")
    control.append(element("p", "field-question", field.question))
    if (field.kind === "repeatable") {
      const group = this.renderRepeatableField(page, field)
      group.id = `studio-field-${field.id}`
      group.tabIndex = -1
      group.setAttribute("role", "group")
      group.setAttribute("aria-label", field.label)
      control.append(group)
    } else {
      const current = this.draftValues.get(field.id) ?? field.value
      const input = field.kind === "single-line" ? element("input") : element("textarea")
      input.id = `studio-field-${field.id}`
      input.dataset.fieldId = field.id
      input.required = field.required
      input.readOnly = field.readOnly === true
      input.setAttribute("aria-invalid", ["invalid", "blocked"].includes(field.validation.state) ? "true" : "false")
      if (field.validation.message) input.setAttribute("aria-describedby", `studio-validation-${field.id}`)
      input.value = Array.isArray(current) ? current.join("\n") : current
      input.addEventListener("input", () => {
        this.draftValues.set(field.id, field.kind === "string-list" ? input.value.split("\n") : input.value)
        this.draftDirty = true
      })
      control.append(input)
    }
    if (field.designState && !field.readOnly) {
      const stateLabel = element("label", "field-label", "Design field state")
      stateLabel.htmlFor = `studio-field-state-${field.id}`
      const state = element("select")
      state.id = `studio-field-state-${field.id}`
      for (const candidate of ["missing", "weak", "complete", "deferred"] as const) {
        const option = element("option")
        option.value = candidate
        option.textContent = candidate
        option.selected = (this.draftStates.get(field.id) ?? field.designState) === candidate
        state.append(option)
      }
      state.addEventListener("change", () => {
        this.draftStates.set(field.id, state.value as DesignFieldState)
        this.draftDirty = true
      })
      control.append(stateLabel, state)
      const deferredLabel = element("label", "field-label", "Deferred reason (required when deferred)")
      deferredLabel.htmlFor = `studio-field-deferred-${field.id}`
      const deferred = element("input")
      deferred.id = `studio-field-deferred-${field.id}`
      deferred.value = this.deferredReasons.get(field.id) ?? ""
      deferred.addEventListener("input", () => {
        this.deferredReasons.set(field.id, deferred.value)
        this.draftDirty = true
      })
      const revisitLabel = element("label", "field-label", "Revisit trigger")
      revisitLabel.htmlFor = `studio-field-revisit-${field.id}`
      const revisit = element("input")
      revisit.id = `studio-field-revisit-${field.id}`
      revisit.value = this.revisitTriggers.get(field.id) ?? ""
      revisit.addEventListener("input", () => {
        this.revisitTriggers.set(field.id, revisit.value)
        this.draftDirty = true
      })
      control.append(deferredLabel, deferred, revisitLabel, revisit)
    }
    if (field.example) {
      const details = element("details")
      details.append(element("summary", undefined, "Show example"), element("p", "prose", field.example))
      control.append(details)
    }
    if (field.validation.message) {
      const validation = element("p", `validation-message ${field.validation.state}`, field.validation.message)
      validation.id = `studio-validation-${field.id}`
      control.append(validation)
    }
    control.append(element("p", "field-provenance", field.provenance))
    wrapper.append(label, control)
    return wrapper
  }

  private renderDesignSection(design: StudioDesignSectionSnapshot, route: StudioRoute): HTMLElement {
    const section = element("section", "section grouped-section")
    section.append(
      element("h3", undefined, "Governed design draft"),
      element("p", "source-line", `Draft revision ${design.draftRevision} · Product revision ${design.baseProductRevision} · ${design.readiness}`),
    )
    const page = { route } as RecordFormPageSnapshot
    const fields = element("div", "field-list")
    for (const field of design.fields) fields.append(this.renderField(page, field))
    section.append(fields)
    if (design.gaps.length > 0 || design.conflicts.length > 0) {
      section.append(this.renderIssues("Design gaps and conflicts", [...design.gaps, ...design.conflicts]))
    }
    const actions = element("div", "action-row")
    const save = element("button", undefined, "Save draft section")
    save.type = "button"
    save.addEventListener("click", () => this.perform({
      kind: "save-draft",
      route,
      draftId: design.draftId,
      draftRevision: design.draftRevision,
      baseRevision: design.baseProductRevision,
      values: Object.fromEntries(this.draftValues),
      states: Object.fromEntries(this.draftStates),
      deferredReasons: Object.fromEntries(this.deferredReasons),
      revisitTriggers: Object.fromEntries(this.revisitTriggers),
    }))
    const readiness = element("button", "secondary", "Evaluate readiness")
    readiness.type = "button"
    readiness.addEventListener("click", () => this.perform({ kind: "validate-section", route, draftId: design.draftId }))
    const revision = element("button", "secondary", "Create Product design revision")
    revision.type = "button"
    revision.disabled = !design.materialChange
    if (revision.disabled) {
      revision.title = "Save a material draft change before creating a revision."
      revision.setAttribute("aria-label", "Create Product design revision. Unavailable: save a material draft change first.")
    }
    revision.addEventListener("click", () => this.perform({
      kind: "create-revision",
      route,
      draftId: design.draftId,
      draftRevision: design.draftRevision,
      baseRevision: design.baseProductRevision,
    }))
    actions.append(save, readiness, revision)
    section.append(actions)
    return section
  }

  private renderRepeatableField(page: RecordFormPageSnapshot, field: StudioFieldSnapshot): HTMLElement {
    const container = element("div")
    const columns = field.columns ?? []
    const table: StudioTableSnapshot = {
      id: `field-${field.id}`,
      title: field.label,
      columns,
      rows: (field.items ?? []).map((item) => ({
        id: item.id,
        cells: item.values,
        actions: [
          { label: "Edit", enabled: !field.readOnly, action: { kind: "repeatable-item", route: page.route, fieldId: field.id, operation: "edit", itemId: item.id } },
          { label: "Move", enabled: !field.readOnly, action: { kind: "repeatable-item", route: page.route, fieldId: field.id, operation: "move-up", itemId: item.id } },
          { label: "Remove", enabled: !field.readOnly, emphasis: "danger", action: { kind: "repeatable-item", route: page.route, fieldId: field.id, operation: "remove", itemId: item.id } },
        ],
      })),
      actions: [{
        label: "Add",
        enabled: !field.readOnly,
        action: { kind: "repeatable-item", route: page.route, fieldId: field.id, operation: "add" },
      }],
    }
    container.append(this.renderTable(table, false))
    return container
  }

  private renderDelivery(page: DeliveryPageSnapshot): HTMLElement {
    const container = element("div")
    container.append(this.renderPageHeader(page))
    if (page.design) container.append(this.renderDesignSection(page.design, page.route))
    for (const table of [page.initiatives, page.changes, page.workItems]) container.append(this.renderTable(table))
    if (page.transitionPreview) {
      const preview = element("section", "section grouped-section")
      preview.append(element("h3", undefined, page.transitionPreview.currentState))
      const reasonLabel = element("label", "field-label", "Reason")
      reasonLabel.htmlFor = "studio-transition-reason"
      const reason = element("textarea")
      reason.id = "studio-transition-reason"
      reason.rows = 3
      preview.append(reasonLabel, reason)
      const list = element("ul", "plain-list")
      for (const next of page.transitionPreview.allowedNextStates) {
        const row = element("li", "plain-row")
        const transition = element("button", "secondary", next.state)
        transition.type = "button"
        transition.disabled = !next.enabled
        transition.title = next.enabled ? next.state : next.reason ?? "Unavailable"
        if (!next.enabled) transition.setAttribute("aria-label", `${next.state}. Unavailable: ${next.reason ?? "Unavailable"}`)
        transition.addEventListener("click", () => {
          if (!reason.value.trim()) {
            this.announce("A state-transition reason is required.", "assertive")
            reason.focus()
            return
          }
          this.perform({
            kind: "transition-record",
            recordType: page.transitionPreview!.recordType,
            recordId: page.transitionPreview!.recordId,
            toState: next.state,
            reason: reason.value.trim(),
          })
        })
        row.append(transition, element("span", "muted", next.enabled ? "Allowed" : next.reason ?? "Unavailable"))
        list.append(row)
      }
      preview.append(list)
      container.append(preview)
    }
    return container
  }

  private renderRisksDecisions(page: RisksDecisionsPageSnapshot): HTMLElement {
    const container = element("div")
    container.append(this.renderPageHeader(page))
    if (page.design) container.append(this.renderDesignSection(page.design, page.route))
    container.append(this.renderTable(page.risks))
    const recommendations = element("section", "section")
    recommendations.append(element("h3", undefined, "Recommendations"), this.renderTable(page.recommendations, false))
    const decisions = element("section", "section")
    decisions.append(element("h3", undefined, "Decisions"), this.renderTable(page.decisions, false))
    container.append(recommendations, decisions)
    return container
  }

  private renderTrace(page: TracePageSnapshot): HTMLElement {
    const container = element("div")
    container.append(this.renderPageHeader(page))
    if (page.design) container.append(this.renderDesignSection(page.design, page.route))
    container.append(this.renderTable(page.relationships), this.renderTable(page.searchResults))
    if (page.caveat) container.append(element("p", "prose muted", page.caveat))
    if (page.impact.length > 0) {
      const impact = element("section", "section")
      impact.append(element("h3", undefined, "Impact analysis"))
      for (const group of page.impact) impact.append(this.renderDefinitionGroup(group.label, group.entries))
      container.append(impact)
    }
    return container
  }

  private renderAgents(page: AgentPageSnapshot): HTMLElement {
    const container = element("div")
    container.append(this.renderPageHeader(page))
    if (page.design) container.append(this.renderDesignSection(page.design, page.route))
    container.append(this.renderTable(page.adapters))
    if (page.selection) {
      const selection = element("section", "section grouped-section")
      selection.append(
        element("h3", undefined, "Agent selection"),
        this.renderDefinitionEntries([
          { term: "Agent", value: page.selection.agent },
          { term: "Model", value: page.selection.model },
          {
            term: "Model identity",
            value: `${page.selection.modelTruthClass}${page.selection.modelAlias ? " · alias" : ""}`,
          },
          ...page.selection.settings,
          { term: "Capability limitations review", value: page.selection.limitationsReviewed ? "Reviewed" : "Required" },
        ]),
        this.renderActionRow(page.selection.actions),
      )
      container.append(selection)
    }
    if (page.selectedAgent.length > 0) container.append(this.renderDefinitionGroup("Selected agent and model", page.selectedAgent))
    if (page.limitations.length > 0) container.append(this.renderIssues("Capability limitations", page.limitations))
    container.append(
      this.renderTable(page.contextPacks),
      this.renderTable(page.workflowPlans),
      this.renderTable(page.toolDefinitions),
      this.renderTable(page.runToolSelections),
      this.renderTable(page.handoffs),
    )
    return container
  }

  private renderRuns(page: RunPageSnapshot): HTMLElement {
    const container = element("div")
    container.append(this.renderPageHeader(page))
    if (page.design) container.append(this.renderDesignSection(page.design, page.route))
    container.append(this.renderTable(page.runs))
    if (page.composer) {
      const composer = element("section", "section grouped-section")
      composer.append(element("h3", undefined, "Run preparation"))
      const stages = element("ol", "run-stepper")
      for (const stage of page.composer.stages) {
        const item = element("li")
        const button = element("button", stage.stage === page.composer.currentStage ? undefined : "secondary")
        button.type = "button"
        if (stage.stage === page.composer.currentStage) button.setAttribute("aria-current", "step")
        button.textContent = `${stage.stage}. ${runStageLabels[stage.stage - 1]} — ${completionLabels[stage.state]}`
        button.disabled = !page.composer.preparedRunId
        button.addEventListener("click", () => {
          if (page.composer?.preparedRunId) {
            this.perform({ kind: "set-run-stage", preparedRunId: page.composer.preparedRunId, stage: stage.stage })
          }
        })
        item.append(button)
        if (stage.summary) item.append(element("div", "muted", stage.summary))
        if (stage.issues.length > 0) item.append(this.renderIssueList(stage.issues))
        stages.append(item)
      }
      composer.append(stages)
      if (page.composer.reviewSections.length > 0) {
        composer.append(this.renderDefinitionGroup(
          "Charter review",
          page.composer.reviewSections.map((entry) => ({ term: entry.label, value: entry.state ? `${entry.value} · ${entry.state}` : entry.value })),
        ))
      }
      composer.append(this.renderActionRow(page.composer.actions))
      container.append(composer)
    }
    if (page.selectedRun.length > 0) container.append(this.renderDefinitionGroup("Selected run", page.selectedRun))
    if (page.events.length > 0) {
      const events = element("section", "section")
      events.append(element("h3", undefined, "Normalized events"))
      const list = element("ol", "event-list")
      for (const event of page.events) {
        const row = element("li", "event-row")
        const summary = element("div")
        summary.append(element("strong", undefined, event.kind), element("div", undefined, event.summary))
        row.append(summary, element("time", "identifier", event.time))
        list.append(row)
      }
      events.append(list)
      container.append(events)
    }
    container.append(this.renderTable(page.evidence))
    if (page.recoveryActions.length > 0) container.append(this.renderActionRow(page.recoveryActions))
    return container
  }

  private renderReadiness(page: ReadinessPageSnapshot): HTMLElement {
    const container = element("div")
    container.append(this.renderPageHeader(page), element("p", "prose", page.statement))
    if (page.design) container.append(this.renderDesignSection(page.design, page.route))
    if (page.nextAction) {
      const next = element("div", "primary-action")
      next.append(this.renderActionButton(page.nextAction))
      container.append(next)
    }
    const list = element("ul", "progress-list")
    for (const section of page.sections) {
      const row = element("li", "progress-row")
      row.append(
        element("span", undefined, studioRouteLabels[section.route]),
        element("span", "muted", `${completionLabels[section.state]} · ${section.gapCount} gap${section.gapCount === 1 ? "" : "s"}`),
      )
      list.append(row)
    }
    const status = element("section", "section")
    status.append(element("h3", undefined, "Design sections"), list)
    container.append(status)
    if (page.gaps.length > 0) container.append(this.renderIssues("Gaps", page.gaps))
    if (page.conflicts.length > 0) container.append(this.renderIssues("Conflicts", page.conflicts))
    if (page.health.length > 0) container.append(this.renderIssues("Workspace health", page.health))
    container.append(
      this.renderTable(page.designRevisions),
      this.renderTable(page.productRevisions),
      this.renderDefinitionGroup("Portable export and import boundary", page.portability),
    )
    return container
  }

  private renderTable(table: StudioTableSnapshot, includeHeading = true): HTMLElement {
    const section = element("section", "section")
    if (includeHeading) section.append(element("h3", undefined, table.title))
    if (table.truncation) {
      const notice = element("p", "prose muted", `${table.truncation.message} Showing ${table.truncation.shown} of ${table.truncation.total}.`)
      notice.setAttribute("role", "status")
      section.append(notice)
    }
    if (table.actions.length > 0) section.append(this.renderActionRow(table.actions))
    if (table.rows.length === 0) {
      if (table.emptyState) section.append(this.renderSurfaceState(table.emptyState))
      return section
    }
    const region = element("div", "table-region")
    region.tabIndex = 0
    region.setAttribute("role", "region")
    region.setAttribute("aria-label", table.title)
    const htmlTable = element("table")
    const head = element("thead")
    const headRow = element("tr")
    const sort = this.sortState.get(table.id)
    for (const column of table.columns) {
      const th = element("th")
      th.scope = "col"
      if (sort?.key === column.key) th.setAttribute("aria-sort", sort.direction)
      const button = element("button", undefined, column.label)
      button.type = "button"
      button.addEventListener("click", () => {
        const direction = sort?.key === column.key && sort.direction === "ascending" ? "descending" : "ascending"
        this.sortState.set(table.id, { key: column.key, direction })
        this.render(false)
      })
      th.append(button)
      headRow.append(th)
    }
    const actionHeader = element("th", undefined, "Actions")
    actionHeader.scope = "col"
    headRow.append(actionHeader)
    head.append(headRow)

    const rows = [...table.rows]
    if (sort) {
      rows.sort((left, right) => {
        const comparison = (left.cells[sort.key] ?? "").localeCompare(right.cells[sort.key] ?? "")
        return sort.direction === "ascending" ? comparison : -comparison
      })
    }
    const body = element("tbody")
    for (const row of rows) {
      const tr = element("tr")
      for (const column of table.columns) {
        const cell = element("td", column.identifier ? "identifier" : undefined, row.cells[column.key] ?? "")
        tr.append(cell)
      }
      const actionCell = element("td", "cell-actions")
      for (const action of row.actions) actionCell.append(this.renderActionButton(action, true))
      tr.append(actionCell)
      body.append(tr)
    }
    htmlTable.append(head, body)
    region.append(htmlTable)
    section.append(region)
    return section
  }

  private renderSurfaceState(state: StudioSurfaceState): HTMLElement {
    const panel = element("section", "state-panel")
    const stopLine = state.kind === "invalid" || state.kind === "blocked"
    if (stopLine) panel.setAttribute("role", "alert")
    const heading = element("h2", undefined, state.title)
    heading.id = "studio-page-title"
    heading.tabIndex = -1
    panel.append(heading)
    if (state.detail) panel.append(element("p", "prose", state.detail))
    if (state.kind === "loading") panel.append(element("progress"))
    if (state.lastVerifiedState) panel.append(this.renderDefinitionGroup("Last verified state", [{ term: "State", value: state.lastVerifiedState }]))
    if (state.knownEffects?.length) panel.append(this.renderStringList("Known effects", state.knownEffects))
    if (state.unknownEffects?.length) panel.append(this.renderStringList("Unknown effects", state.unknownEffects))
    if (state.issues.length > 0) panel.append(this.renderIssueList(state.issues))
    if (state.actions.length > 0) panel.append(this.renderActionRow(state.actions))
    return panel
  }

  private renderInspector(inspector: StudioInspectorSnapshot): HTMLElement {
    const aside = element("aside", "studio-inspector")
    aside.setAttribute("aria-label", "Record relationship and provenance inspector")
    aside.append(element("h2", undefined, inspector.title), this.renderIdentifier(inspector.recordId, "Record ID"))
    if (inspector.entries.length > 0) aside.append(this.renderDefinitionEntries(inspector.entries))
    if (inspector.relationships.length > 0) {
      aside.append(element("h3", undefined, "Relationships"), this.renderDefinitionEntries(inspector.relationships))
    }
    if (inspector.actions.length > 0) aside.append(this.renderActionRow(inspector.actions))
    return aside
  }

  private renderFooter(snapshot: StudioSnapshot): HTMLElement {
    const footer = element("footer", "studio-footer")
    const draftLabels = {
      clean: "No draft changes",
      unsaved: "Draft has unsaved changes",
      "saved-locally": "Draft saved locally",
      "revision-ready": "Draft validated; revision not created",
      "revision-created": "Revision created",
    } as const
    footer.append(
      element("span", undefined, this.draftDirty ? "Draft has unsaved changes" : draftLabels[snapshot.footer.draftState]),
      element("span", undefined, snapshot.footer.sourceRevision === undefined ? "Source revision unavailable" : `Source revision ${snapshot.footer.sourceRevision}`),
      element("span", undefined, snapshot.footer.validationSummary),
      element("span", undefined, `Workspace health: ${snapshot.workspace.health}`),
    )
    return footer
  }

  private renderIssues(title: string, issues: StudioIssue[]): HTMLElement {
    const section = element("section", "section")
    section.append(element("h3", undefined, title), this.renderIssueList(issues))
    return section
  }

  private renderIssueList(issues: StudioIssue[]): HTMLElement {
    const list = element("ul", "issue-list")
    for (const issue of issues) {
      const row = element("li", `issue-row ${issue.severity}`)
      const copy = element("div")
      copy.append(element("div", undefined, issue.message), element("div", "muted", issue.severity))
      if (issue.sourceRecordId) {
        copy.append(this.renderIdentifier(issue.sourceRecordId, "Source record"))
        const open = element("button", "secondary", "Open record")
        open.type = "button"
        open.addEventListener("click", () => this.perform({ kind: "open-record", recordId: issue.sourceRecordId! }))
        row.append(copy, open)
      } else {
        row.append(copy)
      }
      list.append(row)
    }
    return list
  }

  private renderStringList(title: string, values: string[]): HTMLElement {
    const section = element("section", "section")
    section.append(element("h3", undefined, title))
    const list = element("ul", "plain-list")
    for (const value of values) list.append(element("li", "plain-row", value))
    section.append(list)
    return section
  }

  private renderDefinitionGroup(title: string, entries: StudioDefinitionEntry[]): HTMLElement {
    const section = element("section", "section")
    section.append(element("h3", undefined, title), this.renderDefinitionEntries(entries))
    return section
  }

  private renderDefinitionEntries(entries: StudioDefinitionEntry[]): HTMLElement {
    const list = element("dl")
    for (const entry of entries) {
      list.append(element("dt", undefined, entry.term), element("dd", undefined, entry.value))
      if (entry.recordId) {
        const detail = element("dd")
        detail.append(this.renderIdentifier(entry.recordId, "Record ID"))
        list.append(detail)
      }
    }
    return list
  }

  private renderIdentifier(value: string, label: string): HTMLElement {
    const wrapper = element("span", "action-row")
    const code = element("code", "identifier", value)
    code.setAttribute("aria-label", `${label}: ${value}`)
    const copy = element("button", "secondary")
    copy.type = "button"
    copy.title = `Copy ${label.toLowerCase()}`
    copy.setAttribute("aria-label", `Copy ${label.toLowerCase()}`)
    const icon = element("span", "codicon codicon-copy")
    icon.setAttribute("aria-hidden", "true")
    copy.append(icon)
    copy.addEventListener("click", () => {
      void navigator.clipboard.writeText(value).then(
        () => this.announce(`${label} copied.`, "polite"),
        () => this.announce(`${label} could not be copied.`, "assertive"),
      )
    })
    wrapper.append(code, copy)
    return wrapper
  }

  private renderActionRow(actions: StudioActionControl[]): HTMLElement {
    const row = element("div", "action-row")
    for (const action of actions) row.append(this.renderActionButton(action))
    return row
  }

  private renderActionButton(control: StudioActionControl, compact = false): HTMLButtonElement {
    const className = control.emphasis === "danger"
      ? "danger"
      : control.emphasis === "primary"
        ? undefined
        : "secondary"
    const button = element("button", className, control.label)
    button.type = "button"
    if (compact) button.classList.add("compact")
    button.disabled = !control.enabled
    if (control.disabledReason) {
      button.title = control.disabledReason
      button.setAttribute("aria-label", `${control.label}. Unavailable: ${control.disabledReason}`)
    }
    button.addEventListener("click", () => {
      if (control.action.kind === "navigate") this.navigate(control.action.route)
      else this.perform(control.action)
    })
    return button
  }

  private perform(action: StudioAction): void {
    const snapshot = this.snapshot
    if (!snapshot || !isStudioAction(action)) return
    const requestId = crypto.randomUUID()
    this.bridge.post({
      type: "studio.action",
      requestId,
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
      action,
    })
  }

  private focusPageHeading(): void {
    document.getElementById("studio-page-title")?.focus()
  }

  private announce(message: string, priority: "polite" | "assertive"): void {
    const region = priority === "assertive" ? this.assertiveLive : this.politeLive
    region.textContent = ""
    requestAnimationFrame(() => {
      region.textContent = message
    })
  }

  private confirmDiscardDraft(): boolean {
    if (!this.draftDirty) return true
    return window.confirm("Discard uncommitted field edits?")
  }

  private handleGlobalKey(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !this.draftDirty) return
    if (!this.confirmDiscardDraft()) return
    event.preventDefault()
    const page = this.snapshot?.page
    const fields = page?.design?.fields ?? (page?.kind === "record-form" ? page.fields : [])
    if (page && fields.length > 0) {
      this.draftValues.clear()
      this.draftStates.clear()
      this.deferredReasons.clear()
      this.revisitTriggers.clear()
      for (const field of fields) {
        this.draftValues.set(field.id, Array.isArray(field.value) ? [...field.value] : field.value)
        if (field.designState) this.draftStates.set(field.id, field.designState)
        if (field.deferredReason) this.deferredReasons.set(field.id, field.deferredReason)
        if (field.revisitTrigger) this.revisitTriggers.set(field.id, field.revisitTrigger)
      }
      this.draftDirty = false
      this.render(false)
      this.focusPageHeading()
    }
  }
}

export function installStudioClient(): void {
  const root = document.getElementById("studio-root")
  const politeLive = document.getElementById("studio-live-polite")
  const assertiveLive = document.getElementById("studio-live-assertive")
  const channelId = document.body.dataset.studioChannel
  if (!root || !politeLive || !assertiveLive || !channelId) throw new Error("Product Studio document is incomplete")
  const route = document.body.dataset.studioRoute
  const bridge = new HostBridge(channelId)
  const shell = new StudioShell(root, politeLive, assertiveLive, bridge)
  const restoredRoute = bridge.getState()?.route ?? (studioRoutes.includes(route as StudioRoute) ? route as StudioRoute : undefined)
  shell.start(restoredRoute)
}

if (typeof window !== "undefined" && typeof document !== "undefined") installStudioClient()
