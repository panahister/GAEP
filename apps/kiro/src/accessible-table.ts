export type AccessibleTableSortDirection = "ascending" | "descending"

export interface AccessibleTableColumn {
  readonly key: string
  readonly label: string
}

export interface AccessibleTableRow {
  readonly id: string
  readonly cells: Readonly<Record<string, string>>
}

export interface AccessibleMetadataTable {
  readonly id: string
  readonly title: string
  readonly columns: readonly AccessibleTableColumn[]
  readonly rows: readonly AccessibleTableRow[]
  readonly total: number
  readonly omitted: number
  readonly snapshotDigest: string
  readonly sourceBoundary: string
  readonly authorityBoundary: string
}

export interface AccessibleTableView {
  readonly table: AccessibleMetadataTable
  readonly rows: readonly AccessibleTableRow[]
  readonly filter: string
  readonly sortKey?: string
  readonly sortDirection?: AccessibleTableSortDirection
}

const portableKeyPattern = /^[a-z][a-z0-9-]{0,63}$/u

export function createAccessibleMetadataTable(table: AccessibleMetadataTable): AccessibleMetadataTable {
  if (!portableKeyPattern.test(table.id)) throw new TypeError("Accessible table IDs must be portable kebab-case values")
  if (!table.title.trim() || table.title.length > 160) throw new TypeError("Accessible table titles must contain 1 to 160 characters")
  if (table.columns.length === 0 || table.columns.length > 64) throw new RangeError("Accessible tables require 1 to 64 visible columns")
  if (table.rows.length > 1_000) throw new RangeError("Accessible tables can expose at most 1,000 already-bounded rows")
  if (!Number.isSafeInteger(table.total) || !Number.isSafeInteger(table.omitted) ||
    table.total < table.rows.length || table.omitted !== table.total - table.rows.length) {
    throw new RangeError("Accessible table totals must exactly reconcile with visible and omitted rows")
  }
  if (!/^sha256:[0-9a-f]{64}$/u.test(table.snapshotDigest)) throw new TypeError("Accessible tables require one exact snapshot digest")
  if (!table.sourceBoundary.trim() || !table.authorityBoundary.trim()) {
    throw new TypeError("Accessible tables require explicit source and authority boundaries")
  }

  const columnKeys = new Set<string>()
  for (const column of table.columns) {
    if (!portableKeyPattern.test(column.key) || columnKeys.has(column.key)) throw new TypeError("Accessible table column keys must be unique portable values")
    if (!column.label.trim() || column.label.length > 160) throw new TypeError("Accessible table column labels must contain 1 to 160 characters")
    columnKeys.add(column.key)
  }

  const rowIds = new Set<string>()
  for (const row of table.rows) {
    if (!row.id || row.id.length > 256 || rowIds.has(row.id)) throw new TypeError("Accessible table row IDs must be unique bounded values")
    rowIds.add(row.id)
    if (Object.keys(row.cells).length !== table.columns.length ||
      Object.keys(row.cells).some((key) => !columnKeys.has(key))) {
      throw new TypeError("Accessible table rows must contain exactly the visible columns")
    }
    for (const column of table.columns) {
      const value = row.cells[column.key]
      if (typeof value !== "string" || value.length > 4_000) throw new TypeError("Accessible table cells must be bounded strings")
    }
  }
  return Object.freeze({
    ...table,
    columns: Object.freeze(table.columns.map((column) => Object.freeze({ ...column }))),
    rows: Object.freeze(table.rows.map((row) => Object.freeze({ ...row, cells: Object.freeze({ ...row.cells }) }))),
  })
}

export function buildAccessibleTableView(
  table: AccessibleMetadataTable,
  options: {
    readonly filter?: string
    readonly sortKey?: string
    readonly sortDirection?: AccessibleTableSortDirection
  } = {},
): AccessibleTableView {
  const exactTable = createAccessibleMetadataTable(table)
  const filter = options.filter ?? ""
  if (filter.length > 256) throw new RangeError("Accessible table filters can contain at most 256 characters")
  if ((options.sortKey === undefined) !== (options.sortDirection === undefined)) {
    throw new TypeError("Accessible table sort column and direction must be supplied together")
  }
  if (options.sortKey !== undefined && !exactTable.columns.some((column) => column.key === options.sortKey)) {
    throw new TypeError("Accessible table sort column must be one of the visible columns")
  }

  const normalizedFilter = filter.trim().toLocaleLowerCase()
  const rows = exactTable.rows.filter((row) => normalizedFilter.length === 0 ||
    exactTable.columns.some((column) => row.cells[column.key]!.toLocaleLowerCase().includes(normalizedFilter)))
  if (options.sortKey && options.sortDirection) {
    rows.sort((left, right) => {
      const comparison = left.cells[options.sortKey!]!.localeCompare(right.cells[options.sortKey!]!)
      const deterministic = comparison === 0 ? left.id.localeCompare(right.id) : comparison
      return options.sortDirection === "ascending" ? deterministic : -deterministic
    })
  }
  return Object.freeze({
    table: exactTable,
    rows: Object.freeze(rows),
    filter,
    ...(options.sortKey ? { sortKey: options.sortKey, sortDirection: options.sortDirection } : {}),
  })
}

export function renderAccessibleTableText(view: AccessibleTableView): string {
  const sortColumn = view.sortKey === undefined
    ? "source order"
    : `${view.table.columns.find((column) => column.key === view.sortKey)!.label}, ${view.sortDirection}`
  const lines = [
    `GAEP accessible metadata table: ${view.table.title}`,
    "",
    `Showing ${view.rows.length} of ${view.table.rows.length} verified rows; ${view.table.omitted} omitted upstream; source total ${view.table.total}.`,
    `Sort: ${sortColumn}`,
    `Filter: ${view.filter.trim() || "none"}`,
    `Snapshot digest: ${view.table.snapshotDigest}`,
    `Source boundary: ${view.table.sourceBoundary}`,
    "",
  ]
  if (view.rows.length === 0) lines.push("No verified rows match the current filter.")
  for (const [index, row] of view.rows.entries()) {
    lines.push(`${index + 1}. ${view.table.columns.map((column) => `${column.label}: ${row.cells[column.key]}`).join(" · ")}`)
  }
  lines.push("", `Boundary: ${view.table.authorityBoundary}`)
  return `${lines.join("\n")}\n`
}

export function accessibleTableCsv(view: AccessibleTableView): string {
  const cell = (value: string): string => {
    const neutralized = /^\s*[=+\-@]/u.test(value) || /^[\t\r\n]/u.test(value) ? `'${value}` : value
    return `"${neutralized.replaceAll('"', '""')}"`
  }
  return [
    view.table.columns.map((column) => cell(column.label)).join(","),
    ...view.rows.map((row) => view.table.columns.map((column) => cell(row.cells[column.key]!)).join(",")),
  ].join("\r\n")
}
