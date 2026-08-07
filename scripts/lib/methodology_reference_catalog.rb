# frozen_string_literal: true

require "date"
require "json"
require "set"

module MethodologyReferenceCatalog
  CATALOG_ID = "GAEP-REG-011"
  CATALOG_VERSION = "0.3.0"
  SCHEMA_ID = "https://gaep.example/schemas/methodology-reference-catalog-2.0.0.json"
  SCHEMA_VERSION = "2.0.0"
  TARGET_ARTIFACT_ID = "GAEP-CST-004"
  TARGET_ARTIFACT_VERSION = "0.3.0"

  TOP_LEVEL_FIELDS = %w[
    catalogId schemaId schemaVersion version status ownerRole freshnessCheckedAt
    approval authorityEffect claimBoundary concerns references mappings deferredCandidates
  ].freeze
  APPROVAL_FIELDS = %w[state approvedBy approvedAt].freeze
  CONCERN_FIELDS = %w[concernId canonicalName].freeze
  REFERENCE_FIELDS = %w[
    referenceId canonicalName shortName referenceType issuingAuthority versionOrEdition
    versionCertainty publicationDate status officialUri access contentReview freshnessCheckedAt
    rightsStatus licenseOrCopyrightNote supersedes supersededBy underRevision gaepConcernIds
    adoptedConcepts adaptedConcepts explicitlyNotAdopted applicabilityProfiles limitations
    blockedClaims claimLanguage evidenceStatus reviewTrigger nextReviewDate notes
  ].freeze
  ACCESS_FIELDS = %w[status date evidence reason].freeze
  CONTENT_REVIEW_FIELDS = %w[status date depth reason].freeze
  MAPPING_FIELDS = %w[
    concernId concern referenceBindings conceptUsed relationshipStatus gaepAdaptation rationale
    applicability affectedArtifactsOrBehaviors requiredEvidence limitations assessment gaepTarget
    gaepNative
  ].freeze
  REFERENCE_BINDING_FIELDS = %w[referenceId versionOrEdition].freeze
  ASSESSMENT_FIELDS = %w[assessor ownerRole assessmentDate reviewTrigger nextReviewDate].freeze
  PRINCIPAL_ASSESSOR_FIELDS = %w[kind principalId].freeze
  UNASSIGNED_ASSESSOR_FIELDS = %w[kind role].freeze
  GAEP_TARGET_FIELDS = %w[artifactId artifactVersion catalogId catalogVersion].freeze
  DEFERRED_FIELDS = %w[referenceId canonicalName status blockedClaims reviewTrigger notes].freeze

  REFERENCE_TYPES = %w[
    standard framework methodology method model principle-set research-program
    metric-framework regulatory-guidance visualization-model
  ].freeze
  REFERENCE_STATUSES = %w[
    current current-under-revision superseded historical candidate unverifiable
  ].freeze
  VERSION_CERTAINTIES = %w[exact snapshot-bound uncertain unverifiable].freeze
  ACCESS_STATUSES = %w[accessed not-accessed].freeze
  ACCESS_EVIDENCE = %w[
    full-primary-source licensed-copy official-publication official-summary
    official-abstract not-accessed
  ].freeze
  CONTENT_REVIEW_STATUSES = %w[reviewed not-reviewed].freeze
  CONTENT_REVIEW_DEPTHS = %w[
    full-primary-source licensed-copy official-publication official-summary
    official-abstract not-reviewed
  ].freeze
  RIGHTS_STATUSES = %w[
    confirmed-permitted link-and-summary-only permission-required unresolved
  ].freeze
  EVIDENCE_STATUSES = %w[
    primary-source-verified partially-verified version-pending superseded unverified
  ].freeze
  RELATIONSHIP_STATUSES = %w[adopt adapt reject optional gaep-native].freeze
  DEFERRED_STATUSES = %w[
    unresolved-not-assessed unresolved-must-split unresolved-must-select-family-member
    unresolved-must-select-specification-set
  ].freeze

  REQUIRED_REFERENCE_IDS = %w[
    GAEP-XREF-001 GAEP-XREF-002 GAEP-XREF-004 GAEP-XREF-005
    GAEP-XREF-011 GAEP-XREF-012 GAEP-XREF-013 GAEP-XREF-015
    GAEP-XREF-020 GAEP-XREF-021 GAEP-XREF-022 GAEP-XREF-023
    GAEP-XREF-024 GAEP-XREF-025 GAEP-XREF-026 GAEP-XREF-027
  ].freeze

  REFERENCE_STRING_ARRAY_FIELDS = %w[
    supersedes supersededBy gaepConcernIds adoptedConcepts adaptedConcepts
    explicitlyNotAdopted applicabilityProfiles limitations blockedClaims
  ].freeze
  MAPPING_STRING_ARRAY_FIELDS = %w[
    conceptUsed affectedArtifactsOrBehaviors requiredEvidence limitations
  ].freeze
  RESTRICTED_CLAIM_WORDS = %w[
    compliant certified guarantees eliminates enterprise-ready production-ready
    secure safe audit-proof regulator-approved superior
  ].freeze

  module_function

  def canonicalize(catalog)
    ordered = ordered_hash(catalog, TOP_LEVEL_FIELDS)
    ordered["approval"] = ordered_hash(catalog.fetch("approval", {}), APPROVAL_FIELDS)
    ordered["concerns"] = Array(catalog["concerns"])
                            .sort_by { |entry| entry.fetch("concernId", "") }
                            .map { |entry| ordered_hash(entry, CONCERN_FIELDS) }
    ordered["references"] = Array(catalog["references"])
                              .sort_by { |entry| entry.fetch("referenceId", "") }
                              .map { |entry| canonical_reference(entry) }
    ordered["mappings"] = Array(catalog["mappings"])
                            .sort_by { |entry| entry.fetch("concernId", "") }
                            .map { |entry| canonical_mapping(entry) }
    ordered["deferredCandidates"] = Array(catalog["deferredCandidates"])
                                      .sort_by { |entry| entry.fetch("referenceId", "") }
                                      .map do |entry|
      deferred = ordered_hash(entry, DEFERRED_FIELDS)
      deferred["blockedClaims"] = canonical_string_array(entry["blockedClaims"])
      deferred
    end
    ordered
  end

  def canonical_json(catalog)
    "#{JSON.pretty_generate(canonicalize(catalog))}\n"
  end

  def canonical_reference(entry)
    reference = ordered_hash(entry, REFERENCE_FIELDS)
    reference["access"] = ordered_hash(entry.fetch("access", {}), ACCESS_FIELDS)
    reference["contentReview"] = ordered_hash(entry.fetch("contentReview", {}), CONTENT_REVIEW_FIELDS)
    REFERENCE_STRING_ARRAY_FIELDS.each do |field|
      reference[field] = canonical_string_array(entry[field])
    end
    reference
  end

  def canonical_mapping(entry)
    mapping = ordered_hash(entry, MAPPING_FIELDS)
    mapping["referenceBindings"] = Array(entry["referenceBindings"])
                                      .sort_by { |binding| binding.fetch("referenceId", "") }
                                      .map { |binding| ordered_hash(binding, REFERENCE_BINDING_FIELDS) }
    MAPPING_STRING_ARRAY_FIELDS.each do |field|
      mapping[field] = canonical_string_array(entry[field])
    end
    assessment = entry.fetch("assessment", {})
    mapping["assessment"] = ordered_hash(assessment, ASSESSMENT_FIELDS)
    assessor = assessment.fetch("assessor", {})
    assessor_fields = assessor["kind"] == "principal" ? PRINCIPAL_ASSESSOR_FIELDS : UNASSIGNED_ASSESSOR_FIELDS
    mapping["assessment"]["assessor"] = ordered_hash(assessor, assessor_fields)
    mapping["gaepTarget"] = ordered_hash(entry.fetch("gaepTarget", {}), GAEP_TARGET_FIELDS)
    mapping
  end

  def mapping_projection(catalog)
    header = [
      "| GAEP concern ID | GAEP concern | Reference bindings | Concept used | Status | GAEP adaptation | Rationale | Applicability | Artifact or behavior affected | Required evidence | Limitations |",
      "|---|---|---|---|---|---|---|---|---|---|---|"
    ]
    rows = Array(catalog["mappings"]).sort_by { |mapping| mapping.fetch("concernId") }.map do |mapping|
      bindings = mapping.fetch("referenceBindings").map do |binding|
        "`#{binding.fetch('referenceId')}` @ #{binding.fetch('versionOrEdition')}"
      end
      values = [
        "`#{mapping.fetch('concernId')}`",
        mapping.fetch("concern"),
        projection_list(bindings, empty: "GAEP-native; no external owner"),
        projection_list(mapping.fetch("conceptUsed")),
        "`#{mapping.fetch('relationshipStatus')}`#{mapping.fetch('gaepNative') ? '; GAEP-native' : ''}",
        mapping.fetch("gaepAdaptation"),
        mapping.fetch("rationale"),
        mapping.fetch("applicability"),
        projection_list(mapping.fetch("affectedArtifactsOrBehaviors")),
        projection_list(mapping.fetch("requiredEvidence")),
        projection_list(mapping.fetch("limitations"))
      ]
      "| #{values.map { |value| markdown_cell(value) }.join(' | ')} |"
    end
    (header + rows).join("\n")
  end

  def assessment_projection(catalog)
    header = [
      "| GAEP concern ID | Assessor | Accountable owner | Assessment date | Review trigger | Next review | GAEP target |",
      "|---|---|---|---|---|---|---|"
    ]
    rows = Array(catalog["mappings"]).sort_by { |mapping| mapping.fetch("concernId") }.map do |mapping|
      assessment = mapping.fetch("assessment")
      assessor = assessment.fetch("assessor")
      assessor_label = if assessor.fetch("kind") == "principal"
                         "Principal `#{assessor.fetch('principalId')}`"
                       else
                         "Unassigned role: #{assessor.fetch('role')}"
                       end
      target = mapping.fetch("gaepTarget")
      values = [
        "`#{mapping.fetch('concernId')}`",
        assessor_label,
        assessment.fetch("ownerRole"),
        assessment.fetch("assessmentDate"),
        assessment.fetch("reviewTrigger"),
        assessment.fetch("nextReviewDate"),
        "`#{target.fetch('artifactId')}` @ #{target.fetch('artifactVersion')}; `#{target.fetch('catalogId')}` @ #{target.fetch('catalogVersion')}"
      ]
      "| #{values.map { |value| markdown_cell(value) }.join(' | ')} |"
    end
    (header + rows).join("\n")
  end

  def reference_projection(catalog)
    header = [
      "| Reference ID | Current source | Type | Version or edition | Certainty | Status | Access | Content review | Rights | Freshness check | Next review | Evidence status |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|"
    ]
    rows = Array(catalog["references"]).sort_by { |reference| reference.fetch("referenceId") }.map do |reference|
      access = reference.fetch("access")
      review = reference.fetch("contentReview")
      values = [
        "`#{reference.fetch('referenceId')}`",
        reference.fetch("shortName"),
        "`#{reference.fetch('referenceType')}`",
        reference.fetch("versionOrEdition"),
        "`#{reference.fetch('versionCertainty')}`",
        "`#{reference.fetch('status')}`",
        "`#{access.fetch('status')}` / `#{access.fetch('evidence')}` / #{access.fetch('date') || 'no date'}",
        "`#{review.fetch('status')}` / `#{review.fetch('depth')}` / #{review.fetch('date') || 'no date'}",
        "`#{reference.fetch('rightsStatus')}`",
        reference.fetch("freshnessCheckedAt"),
        reference.fetch("nextReviewDate"),
        "`#{reference.fetch('evidenceStatus')}`"
      ]
      "| #{values.map { |value| markdown_cell(value) }.join(' | ')} |"
    end
    (header + rows).join("\n")
  end

  # JSON Schema owns structure, required fields, primitive types, patterns, enums,
  # nullability, formats, and uniqueItems. This validator owns catalog-wide
  # relationships, chronology, claim/method boundaries, and canonical ordering.
  def validate(catalog, raw_text: nil)
    errors = []
    return ["catalog root must be an object"] unless catalog.is_a?(Hash)

    concerns = Array(catalog["concerns"])
    references = Array(catalog["references"])
    mappings = Array(catalog["mappings"])
    deferred = Array(catalog["deferredCandidates"])

    concern_ids = concerns.map { |entry| entry["concernId"] if entry.is_a?(Hash) }.compact
    reference_ids = references.map { |entry| entry["referenceId"] if entry.is_a?(Hash) }.compact
    mapping_concern_ids = mappings.map { |entry| entry["concernId"] if entry.is_a?(Hash) }.compact
    deferred_ids = deferred.map { |entry| entry["referenceId"] if entry.is_a?(Hash) }.compact

    validate_unique(errors, "concernId", concern_ids)
    validate_unique(errors, "referenceId", reference_ids)
    validate_unique(errors, "mapping concernId", mapping_concern_ids)
    validate_unique(errors, "deferred referenceId", deferred_ids)

    missing_required = REQUIRED_REFERENCE_IDS - reference_ids
    errors << "required references missing: #{missing_required.join(', ')}" unless missing_required.empty?
    overlap = reference_ids & deferred_ids
    errors << "assessed and deferred reference IDs overlap: #{overlap.join(', ')}" unless overlap.empty?

    missing_mappings = concern_ids - mapping_concern_ids
    errors << "concerns without mappings: #{missing_mappings.join(', ')}" unless missing_mappings.empty?
    extra_mappings = mapping_concern_ids - concern_ids
    errors << "mappings reference unknown concerns: #{extra_mappings.join(', ')}" unless extra_mappings.empty?

    concern_by_id = concerns.map { |entry| [entry["concernId"], entry] if entry.is_a?(Hash) }.compact.to_h
    reference_by_id = references.map { |entry| [entry["referenceId"], entry] if entry.is_a?(Hash) }.compact.to_h
    mapping_by_concern = mappings.map { |entry| [entry["concernId"], entry] if entry.is_a?(Hash) }.compact.to_h

    references.each_with_index do |reference, index|
      validate_reference_semantics(errors, reference, index, concern_by_id, reference_by_id)
    end
    validate_supersession_graph(errors, reference_by_id)
    mappings.each_with_index do |mapping, index|
      validate_mapping_semantics(errors, mapping, index, concern_by_id, reference_by_id, catalog)
    end
    validate_mapping_reference_symmetry(errors, mapping_by_concern, reference_by_id)

    if raw_text && raw_text != canonical_json(catalog)
      errors << "catalog serialization or collection ordering is not canonical"
    end
    errors
  end

  def validate_reference_semantics(errors, reference, index, concern_by_id, reference_by_id)
    return unless reference.is_a?(Hash)

    prefix = "references.#{index}"
    reference_id = reference["referenceId"]
    unknown_concerns = Array(reference["gaepConcernIds"]) - concern_by_id.keys
    errors << "#{prefix}.gaepConcernIds contains unknown IDs: #{unknown_concerns.join(', ')}" unless unknown_concerns.empty?

    Array(reference["supersedes"]).each do |target_id|
      errors << "#{prefix}.supersedes contains unknown reference ID: #{target_id}" unless reference_by_id.key?(target_id)
      errors << "#{prefix} cannot supersede itself" if target_id == reference_id
    end
    Array(reference["supersededBy"]).each do |target_id|
      errors << "#{prefix}.supersededBy contains unknown reference ID: #{target_id}" unless reference_by_id.key?(target_id)
      errors << "#{prefix} cannot be superseded by itself" if target_id == reference_id
    end

    if reference["status"] == "superseded" && Array(reference["supersededBy"]).empty?
      errors << "#{prefix} superseded status requires a successor reference"
    end
    if !Array(reference["supersededBy"]).empty? && reference["status"] != "superseded"
      errors << "#{prefix} a reference with a successor must have superseded status"
    end
    if reference["status"] == "current-under-revision" && reference["underRevision"] != true
      errors << "#{prefix} current-under-revision status requires underRevision true"
    end
    if reference["status"] == "current" && reference["underRevision"] != false
      errors << "#{prefix} current status is incompatible with underRevision true"
    end
    if reference["underRevision"] == true && !%w[current-under-revision candidate].include?(reference["status"])
      errors << "#{prefix} underRevision true requires current-under-revision or candidate status"
    end
    if reference["status"] == "unverifiable" && reference["versionCertainty"] != "unverifiable"
      errors << "#{prefix} unverifiable status requires unverifiable version certainty"
    end
    if reference["versionCertainty"] == "unverifiable" && reference["status"] != "unverifiable"
      errors << "#{prefix} unverifiable version certainty requires unverifiable status"
    end
    if reference["versionCertainty"] != "exact" && Array(reference["blockedClaims"]).empty?
      errors << "#{prefix} non-exact version certainty requires blocked claims"
    end
    if reference["evidenceStatus"] == "version-pending" && !reference["underRevision"] && reference["versionCertainty"] == "exact"
      errors << "#{prefix} version-pending evidence conflicts with an exact, non-revising reference"
    end

    publication = parse_date(reference["publicationDate"])
    access = parse_date(reference.dig("access", "date"))
    review = parse_date(reference.dig("contentReview", "date"))
    freshness = parse_date(reference["freshnessCheckedAt"])
    next_review = parse_date(reference["nextReviewDate"])
    errors << "#{prefix}.access.date is earlier than publicationDate" if publication && access && access < publication
    errors << "#{prefix}.contentReview.date is earlier than access.date" if access && review && review < access
    errors << "#{prefix}.freshnessCheckedAt is earlier than access or content review" if freshness && [access, review].compact.any? { |date| freshness < date }
    errors << "#{prefix}.nextReviewDate is earlier than freshnessCheckedAt" if freshness && next_review && next_review < freshness

    if reference["evidenceStatus"] == "unverified" && strong_claim?(reference["claimLanguage"])
      errors << "#{prefix} unverified source supports a strong claim"
    end
    errors << "#{prefix}.claimLanguage is stronger than recorded evidence" if strong_claim?(reference["claimLanguage"])
    if reference["canonicalName"].to_s.match?(/\b(?:Figma|Codex|Claude Code|GitHub|Jira|competitor product)\b/i) &&
       %w[method methodology model principle-set].include?(reference["referenceType"])
      errors << "#{prefix} classifies a replaceable tool, provider, or competitor Product as methodology"
    end
  end

  def validate_mapping_semantics(errors, mapping, index, concern_by_id, reference_by_id, catalog)
    return unless mapping.is_a?(Hash)

    prefix = "mappings.#{index}"
    concern_id = mapping["concernId"]
    concern = concern_by_id[concern_id]
    if concern && mapping["concern"] != concern["canonicalName"]
      errors << "#{prefix}.concern must equal the canonical concern name"
    end

    bindings = Array(mapping["referenceBindings"])
    binding_ids = bindings.map { |binding| binding["referenceId"] if binding.is_a?(Hash) }.compact
    validate_unique(errors, "#{prefix} reference binding", binding_ids)
    unknown = binding_ids - reference_by_id.keys
    errors << "#{prefix}.referenceBindings contains unknown IDs: #{unknown.join(', ')}" unless unknown.empty?
    bindings.each do |binding|
      next unless binding.is_a?(Hash)
      reference = reference_by_id[binding["referenceId"]]
      next unless reference
      if binding["versionOrEdition"] != reference["versionOrEdition"]
        errors << "#{prefix} reference binding version is stale for #{binding['referenceId']}"
      end
    end

    if mapping["gaepNative"] == true
      errors << "#{prefix} GAEP-native mapping cannot attribute ownership to external references" unless bindings.empty?
      errors << "#{prefix} GAEP-native mapping requires gaep-native relationship" unless mapping["relationshipStatus"] == "gaep-native"
    else
      errors << "#{prefix} non-native mapping requires at least one external reference" if bindings.empty?
      errors << "#{prefix} non-native mapping cannot use gaep-native relationship" if mapping["relationshipStatus"] == "gaep-native"
    end

    target = mapping.fetch("gaepTarget", {})
    unless target["artifactId"] == TARGET_ARTIFACT_ID && target["artifactVersion"] == TARGET_ARTIFACT_VERSION
      errors << "#{prefix} GAEP target artifact identity or version is stale"
    end
    unless target["catalogId"] == catalog["catalogId"] && target["catalogVersion"] == catalog["version"]
      errors << "#{prefix} GAEP target catalog identity or version is stale"
    end

    assessment = mapping.fetch("assessment", {})
    assessor = assessment.fetch("assessor", {})
    if assessor["kind"] == "principal" && assessor["principalId"].to_s.empty?
      errors << "#{prefix} principal assessor identity is missing"
    elsif assessor["kind"] == "unassigned-role" && assessor["role"].to_s.empty?
      errors << "#{prefix} unassigned assessor role is missing"
    end
    errors << "#{prefix} accountable owner role is missing" if assessment["ownerRole"].to_s.empty?
    assessment_date = parse_date(assessment["assessmentDate"])
    next_review = parse_date(assessment["nextReviewDate"])
    errors << "#{prefix} next review date is earlier than assessment date" if assessment_date && next_review && next_review < assessment_date

    flattened = JSON.generate(mapping)
    if flattened.match?(/DDD[^.]{0,60}(?:mandatory for (?:all|every)|universally required)/i)
      errors << "#{prefix} imposes universal DDD without applicability"
    end
    if flattened.match?(/DDD[^.]{0,50}(?:implies|requires|means)[^.]{0,20}microservices/i)
      errors << "#{prefix} incorrectly implies DDD requires microservices"
    end
    if flattened.match?(/freeze[^.]{0,80}(?:entire|full)[^.]{0,50}(?:system|product)[^.]{0,50}before implementation/i)
      errors << "#{prefix} turns architecture-before-implementation into fixed full-scope waterfall"
    end
    if mapping["concern"].to_s.match?(/\b(?:Figma|Jira|GitHub)\b.*\bphase\b|\bphase\b.*\b(?:Figma|Jira|GitHub)\b/i)
      errors << "#{prefix} names a lifecycle phase after a vendor tool"
    end
  end

  def validate_mapping_reference_symmetry(errors, mapping_by_concern, reference_by_id)
    mapping_by_concern.each do |concern_id, mapping|
      Array(mapping["referenceBindings"]).each do |binding|
        next unless binding.is_a?(Hash)
        reference = reference_by_id[binding["referenceId"]]
        next unless reference
        unless Array(reference["gaepConcernIds"]).include?(concern_id)
          errors << "mapping #{concern_id} references #{binding['referenceId']} without reciprocal gaepConcernIds"
        end
      end
    end
    reference_by_id.each_value do |reference|
      Array(reference["gaepConcernIds"]).each do |concern_id|
        mapping = mapping_by_concern[concern_id]
        next unless mapping
        binding_ids = Array(mapping["referenceBindings"]).map { |binding| binding["referenceId"] if binding.is_a?(Hash) }.compact
        unless binding_ids.include?(reference["referenceId"])
          errors << "reference #{reference['referenceId']} names #{concern_id} without reciprocal mapping binding"
        end
      end
    end
  end

  def validate_supersession_graph(errors, reference_by_id)
    reference_by_id.each_value do |reference|
      reference_id = reference["referenceId"]
      Array(reference["supersedes"]).each do |predecessor_id|
        predecessor = reference_by_id[predecessor_id]
        next unless predecessor
        unless Array(predecessor["supersededBy"]).include?(reference_id)
          errors << "supersession edge #{reference_id} -> #{predecessor_id} is not reciprocal"
        end
        unless predecessor["status"] == "superseded"
          errors << "superseded predecessor #{predecessor_id} must have superseded status"
        end
      end
      Array(reference["supersededBy"]).each do |successor_id|
        successor = reference_by_id[successor_id]
        next unless successor
        unless Array(successor["supersedes"]).include?(reference_id)
          errors << "supersession edge #{reference_id} <- #{successor_id} is not reciprocal"
        end
      end
    end

    graph = reference_by_id.transform_values { |entry| Array(entry["supersedes"]).select { |target| reference_by_id.key?(target) } }
    visiting = Set.new
    visited = Set.new
    visit = lambda do |node, path|
      return if visited.include?(node)
      if visiting.include?(node)
        errors << "supersession cycle: #{(path + [node]).join(' -> ')}"
        return
      end
      visiting << node
      Array(graph[node]).each { |target| visit.call(target, path + [node]) }
      visiting.delete(node)
      visited << node
    end
    graph.each_key { |node| visit.call(node, []) }
  end

  def validate_unique(errors, label, values)
    duplicates = values.compact.group_by(&:itself).select { |_value, entries| entries.length > 1 }.keys
    errors << "duplicate #{label}: #{duplicates.join(', ')}" unless duplicates.empty?
  end

  def parse_date(value)
    return nil unless value.is_a?(String)
    Date.iso8601(value)
  rescue Date::Error
    nil
  end

  def strong_claim?(text)
    candidate = text.to_s.downcase
    return false if candidate.empty?
    scrubbed = candidate.gsub(/(?:does not|do not|no|not|without)\s+(?:claim(?:ed|s|ing)?\s+)?[^.;]{0,80}(?:#{RESTRICTED_CLAIM_WORDS.map { |word| Regexp.escape(word) }.join('|')})/, "")
    scrubbed.match?(/\b(?:is|are)\s+(?:fully\s+)?(?:[a-z0-9]+-)?(?:compliant|certified|enterprise-ready|production-ready|secure|safe|audit-proof|regulator-approved|superior)\b/) ||
      scrubbed.match?(/\b(?:guarantees?|ensures?|eliminates?)\b/) ||
      scrubbed.match?(/\bconforms? to\b|\bindustry standard\b/)
  end

  def ordered_hash(source, fields)
    fields.each_with_object({}) { |field, ordered| ordered[field] = source[field] }
  end

  def canonical_string_array(value)
    Array(value).sort
  end

  def projection_list(values, empty: "none")
    items = Array(values)
    return empty if items.empty?
    items.join("<br>")
  end

  def markdown_cell(value)
    value.to_s.gsub("|", "\\|").gsub("\n", "<br>")
  end
end
