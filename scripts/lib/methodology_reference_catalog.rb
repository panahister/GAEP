# frozen_string_literal: true

require "date"
require "json"
require "set"
require "uri"

module MethodologyReferenceCatalog
  TOP_LEVEL_FIELDS = %w[
    catalogId schemaVersion version status ownerRole checkedAt approval
    authorityEffect claimBoundary concerns references mappings deferredCandidates
  ].freeze
  REFERENCE_FIELDS = %w[
    referenceId canonicalName shortName referenceType issuingAuthority
    versionOrEdition publicationDate status officialUri checkedAt accessEvidence
    licenseOrCopyrightNote supersedes supersededBy underRevision gaepConcernIds
    adoptedConcepts adaptedConcepts explicitlyNotAdopted applicabilityProfiles
    limitations claimLanguage evidenceStatus reviewTrigger nextReviewAt notes
  ].freeze
  CONCERN_FIELDS = %w[concernId canonicalName].freeze
  MAPPING_FIELDS = %w[
    concernId concern referenceIds conceptUsed relationshipStatus gaepAdaptation
    rationale applicability affectedArtifactsOrBehaviors requiredEvidence
    limitations reviewTrigger gaepNative
  ].freeze
  DEFERRED_FIELDS = %w[referenceId canonicalName status reviewTrigger notes].freeze

  REFERENCE_TYPES = %w[
    standard framework methodology method model principle-set research-program
    metric-framework regulatory-guidance visualization-model
  ].freeze
  REFERENCE_STATUSES = %w[
    current current-under-revision superseded historical candidate unverifiable
  ].freeze
  ACCESS_EVIDENCE = %w[
    full-primary-source-reviewed licensed-copy-reviewed
    official-publication-reviewed official-summary-reviewed official-abstract-only
    unverified
  ].freeze
  EVIDENCE_STATUSES = %w[
    primary-source-verified partially-verified version-pending superseded unverified
  ].freeze
  RELATIONSHIP_STATUSES = %w[adopt adapt reject optional gaep-native].freeze

  REQUIRED_REFERENCE_IDS = %w[
    GAEP-XREF-001 GAEP-XREF-002 GAEP-XREF-004 GAEP-XREF-005
    GAEP-XREF-011 GAEP-XREF-012 GAEP-XREF-013 GAEP-XREF-015
    GAEP-XREF-020 GAEP-XREF-021 GAEP-XREF-022 GAEP-XREF-023
    GAEP-XREF-024 GAEP-XREF-025 GAEP-XREF-026 GAEP-XREF-027
  ].freeze

  STRING_ARRAY_FIELDS = %w[
    supersedes supersededBy gaepConcernIds adoptedConcepts adaptedConcepts
    explicitlyNotAdopted applicabilityProfiles limitations
  ].freeze
  MAPPING_ARRAY_FIELDS = %w[
    referenceIds conceptUsed affectedArtifactsOrBehaviors requiredEvidence limitations
  ].freeze
  RESTRICTED_CLAIM_WORDS = %w[
    compliant certified guarantees eliminates enterprise-ready production-ready
    secure safe audit-proof regulator-approved superior
  ].freeze

  module_function

  def canonicalize(catalog)
    ordered = ordered_hash(catalog, TOP_LEVEL_FIELDS)
    ordered["approval"] = ordered_hash(catalog.fetch("approval", {}), %w[state approvedBy approvedAt])
    ordered["concerns"] = Array(catalog["concerns"])
                            .sort_by { |entry| entry.fetch("concernId", "") }
                            .map { |entry| ordered_hash(entry, CONCERN_FIELDS) }
    ordered["references"] = Array(catalog["references"])
                              .sort_by { |entry| entry.fetch("referenceId", "") }
                              .map do |entry|
      reference = ordered_hash(entry, REFERENCE_FIELDS)
      STRING_ARRAY_FIELDS.each { |field| reference[field] = canonical_string_array(entry[field]) }
      reference
    end
    ordered["mappings"] = Array(catalog["mappings"])
                            .sort_by { |entry| entry.fetch("concernId", "") }
                            .map do |entry|
      mapping = ordered_hash(entry, MAPPING_FIELDS)
      MAPPING_ARRAY_FIELDS.each { |field| mapping[field] = canonical_string_array(entry[field]) }
      mapping
    end
    ordered["deferredCandidates"] = Array(catalog["deferredCandidates"])
                                      .sort_by { |entry| entry.fetch("referenceId", "") }
                                      .map { |entry| ordered_hash(entry, DEFERRED_FIELDS) }
    ordered
  end

  def canonical_json(catalog)
    "#{JSON.pretty_generate(canonicalize(catalog))}\n"
  end

  def mapping_projection(catalog)
    header = [
      "| GAEP concern ID | GAEP concern | Reference IDs | Concept used | Status | GAEP adaptation | Rationale | Applicability | Artifact or behavior affected | Required evidence | Limitations | Review trigger |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|"
    ]
    rows = Array(catalog["mappings"]).sort_by { |mapping| mapping.fetch("concernId") }.map do |mapping|
      values = [
        "`#{mapping.fetch('concernId')}`",
        mapping.fetch("concern"),
        projection_list(mapping.fetch("referenceIds"), code: true, empty: "GAEP-native; no external owner"),
        projection_list(mapping.fetch("conceptUsed")),
        "`#{mapping.fetch('relationshipStatus')}`#{mapping.fetch('gaepNative') ? '; GAEP-native' : ''}",
        mapping.fetch("gaepAdaptation"),
        mapping.fetch("rationale"),
        mapping.fetch("applicability"),
        projection_list(mapping.fetch("affectedArtifactsOrBehaviors")),
        projection_list(mapping.fetch("requiredEvidence")),
        projection_list(mapping.fetch("limitations")),
        mapping.fetch("reviewTrigger")
      ]
      "| #{values.map { |value| markdown_cell(value) }.join(' | ')} |"
    end
    (header + rows).join("\n")
  end

  def reference_projection(catalog)
    header = [
      "| Reference ID | Current source | Type | Version or edition | Status | Access evidence | Evidence status |",
      "|---|---|---|---|---|---|---|"
    ]
    rows = Array(catalog["references"]).sort_by { |reference| reference.fetch("referenceId") }.map do |reference|
      values = [
        "`#{reference.fetch('referenceId')}`",
        reference.fetch("shortName"),
        "`#{reference.fetch('referenceType')}`",
        reference.fetch("versionOrEdition"),
        "`#{reference.fetch('status')}`",
        "`#{reference.fetch('accessEvidence')}`",
        "`#{reference.fetch('evidenceStatus')}`"
      ]
      "| #{values.map { |value| markdown_cell(value) }.join(' | ')} |"
    end
    (header + rows).join("\n")
  end

  def validate(catalog, raw_text: nil)
    errors = []
    unless catalog.is_a?(Hash)
      return ["catalog root must be an object"]
    end

    validate_exact_fields(errors, "catalog", catalog, TOP_LEVEL_FIELDS)
    errors << "catalogId must be GAEP-REG-011" unless catalog["catalogId"] == "GAEP-REG-011"
    errors << "schemaVersion must be 1.0.0" unless catalog["schemaVersion"] == "1.0.0"
    errors << "catalog status must be proposed" unless catalog["status"] == "proposed"
    errors << "catalog authorityEffect must be none" unless catalog["authorityEffect"] == "none"
    errors << "catalog approval state must be not-approved" unless catalog.dig("approval", "state") == "not-approved"
    errors << "catalog approval must not identify approvers" unless Array(catalog.dig("approval", "approvedBy")).empty?
    errors << "catalog approval must not have approvedAt" unless catalog.dig("approval", "approvedAt").nil?
    validate_date(errors, "catalog.checkedAt", catalog["checkedAt"], full: true)

    concerns = Array(catalog["concerns"])
    concern_ids = concerns.map { |entry| entry.is_a?(Hash) ? entry["concernId"] : nil }
    validate_unique(errors, "concernId", concern_ids)
    concerns.each_with_index do |entry, index|
      unless entry.is_a?(Hash)
        errors << "concerns.#{index} must be an object"
        next
      end
      validate_exact_fields(errors, "concerns.#{index}", entry, CONCERN_FIELDS)
      errors << "concerns.#{index}.concernId is invalid" unless entry["concernId"].to_s.match?(/\AGAEP-MTH-CON-\d{3}\z/)
      validate_non_empty_string(errors, "concerns.#{index}.canonicalName", entry["canonicalName"])
    end

    references = Array(catalog["references"])
    reference_ids = references.map { |entry| entry.is_a?(Hash) ? entry["referenceId"] : nil }
    validate_unique(errors, "referenceId", reference_ids)
    missing_required = REQUIRED_REFERENCE_IDS - reference_ids
    errors << "required references missing: #{missing_required.join(', ')}" unless missing_required.empty?
    known_concerns = concern_ids.compact.to_set
    references.each_with_index do |reference, index|
      validate_reference(errors, reference, index, known_concerns)
    end
    validate_supersession_graph(errors, references)

    mappings = Array(catalog["mappings"])
    mapping_concern_ids = mappings.map { |entry| entry.is_a?(Hash) ? entry["concernId"] : nil }
    validate_unique(errors, "mapping concernId", mapping_concern_ids)
    missing_mappings = concern_ids.compact - mapping_concern_ids.compact
    errors << "concerns without mappings: #{missing_mappings.join(', ')}" unless missing_mappings.empty?
    extra_mappings = mapping_concern_ids.compact - concern_ids.compact
    errors << "mappings reference unknown concerns: #{extra_mappings.join(', ')}" unless extra_mappings.empty?
    known_references = reference_ids.compact.to_set
    mappings.each_with_index do |mapping, index|
      validate_mapping(errors, mapping, index, known_concerns, known_references)
    end

    deferred = Array(catalog["deferredCandidates"])
    deferred_ids = deferred.map { |entry| entry.is_a?(Hash) ? entry["referenceId"] : nil }
    validate_unique(errors, "deferred referenceId", deferred_ids)
    overlap = reference_ids.compact & deferred_ids.compact
    errors << "assessed and deferred reference IDs overlap: #{overlap.join(', ')}" unless overlap.empty?
    deferred.each_with_index do |entry, index|
      unless entry.is_a?(Hash)
        errors << "deferredCandidates.#{index} must be an object"
        next
      end
      validate_exact_fields(errors, "deferredCandidates.#{index}", entry, DEFERRED_FIELDS)
      errors << "deferredCandidates.#{index}.status must begin unresolved-" unless entry["status"].to_s.start_with?("unresolved-")
      %w[referenceId canonicalName reviewTrigger notes].each do |field|
        validate_non_empty_string(errors, "deferredCandidates.#{index}.#{field}", entry[field])
      end
    end

    if raw_text && raw_text != canonical_json(catalog)
      errors << "catalog serialization or collection ordering is not canonical"
    end
    errors
  end

  def validate_reference(errors, reference, index, known_concerns)
    unless reference.is_a?(Hash)
      errors << "references.#{index} must be an object"
      return
    end
    prefix = "references.#{index}"
    validate_exact_fields(errors, prefix, reference, REFERENCE_FIELDS)
    %w[referenceId canonicalName shortName issuingAuthority versionOrEdition licenseOrCopyrightNote claimLanguage reviewTrigger notes].each do |field|
      validate_non_empty_string(errors, "#{prefix}.#{field}", reference[field])
    end
    errors << "#{prefix}.referenceId is invalid" unless reference["referenceId"].to_s.match?(/\AGAEP-XREF-\d{3}\z/)
    errors << "#{prefix}.referenceType is invalid" unless REFERENCE_TYPES.include?(reference["referenceType"])
    errors << "#{prefix}.status is invalid" unless REFERENCE_STATUSES.include?(reference["status"])
    errors << "#{prefix}.accessEvidence is invalid" unless ACCESS_EVIDENCE.include?(reference["accessEvidence"])
    errors << "#{prefix}.evidenceStatus is invalid" unless EVIDENCE_STATUSES.include?(reference["evidenceStatus"])
    validate_https(errors, "#{prefix}.officialUri", reference["officialUri"])
    publication = validate_date(errors, "#{prefix}.publicationDate", reference["publicationDate"], allow_partial: true)
    checked = validate_date(errors, "#{prefix}.checkedAt", reference["checkedAt"], full: true)
    review = validate_date(errors, "#{prefix}.nextReviewAt", reference["nextReviewAt"], full: true)
    errors << "#{prefix}.checkedAt is earlier than publicationDate" if publication && checked && checked < publication
    errors << "#{prefix}.nextReviewAt is earlier than checkedAt" if checked && review && review < checked
    errors << "#{prefix}.underRevision must be boolean" unless [true, false].include?(reference["underRevision"])
    if reference["status"] == "current-under-revision" && reference["underRevision"] != true
      errors << "#{prefix} current-under-revision status requires underRevision true"
    end
    if reference["status"] == "current" && reference["underRevision"] != false
      errors << "#{prefix} current status is incompatible with underRevision true"
    end
    if reference["status"] == "superseded" && Array(reference["supersededBy"]).empty?
      errors << "#{prefix} superseded status requires supersededBy"
    end
    STRING_ARRAY_FIELDS.each do |field|
      validate_string_array(errors, "#{prefix}.#{field}", reference[field])
    end
    unknown_concerns = Array(reference["gaepConcernIds"]) - known_concerns.to_a
    errors << "#{prefix}.gaepConcernIds contains unknown IDs: #{unknown_concerns.join(', ')}" unless unknown_concerns.empty?
    if Array(reference["supersedes"]).include?(reference["referenceId"]) || Array(reference["supersededBy"]).include?(reference["referenceId"])
      errors << "#{prefix} cannot supersede itself"
    end
    if reference["evidenceStatus"] == "unverified" && strong_claim?(reference["claimLanguage"])
      errors << "#{prefix} unverified source supports a strong claim"
    end
    errors << "#{prefix}.claimLanguage is stronger than recorded evidence" if strong_claim?(reference["claimLanguage"])
    if reference["canonicalName"].to_s.match?(/\b(?:Figma|Codex|Claude Code|GitHub|Jira)\b/i) && %w[method methodology model principle-set].include?(reference["referenceType"])
      errors << "#{prefix} classifies a replaceable tool or provider as methodology"
    end
  end

  def validate_mapping(errors, mapping, index, known_concerns, known_references)
    unless mapping.is_a?(Hash)
      errors << "mappings.#{index} must be an object"
      return
    end
    prefix = "mappings.#{index}"
    validate_exact_fields(errors, prefix, mapping, MAPPING_FIELDS)
    %w[concernId concern relationshipStatus gaepAdaptation rationale applicability reviewTrigger].each do |field|
      validate_non_empty_string(errors, "#{prefix}.#{field}", mapping[field])
    end
    errors << "#{prefix}.concernId is unknown" unless known_concerns.include?(mapping["concernId"])
    errors << "#{prefix}.relationshipStatus is invalid" unless RELATIONSHIP_STATUSES.include?(mapping["relationshipStatus"])
    errors << "#{prefix}.gaepNative must be boolean" unless [true, false].include?(mapping["gaepNative"])
    MAPPING_ARRAY_FIELDS.each { |field| validate_string_array(errors, "#{prefix}.#{field}", mapping[field]) }
    unknown_references = Array(mapping["referenceIds"]) - known_references.to_a
    errors << "#{prefix}.referenceIds contains unknown IDs: #{unknown_references.join(', ')}" unless unknown_references.empty?
    if mapping["gaepNative"] == true && !Array(mapping["referenceIds"]).empty?
      errors << "#{prefix} GAEP-native mapping cannot attribute ownership to external references"
    end
    if mapping["gaepNative"] == false && Array(mapping["referenceIds"]).empty?
      errors << "#{prefix} non-native mapping requires at least one reference"
    end
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

  def validate_supersession_graph(errors, references)
    known = references.map { |entry| entry["referenceId"] if entry.is_a?(Hash) }.compact.to_set
    graph = {}
    references.each do |entry|
      next unless entry.is_a?(Hash) && known.include?(entry["referenceId"])
      graph[entry["referenceId"]] = Array(entry["supersededBy"]).select { |target| known.include?(target) }
    end
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

  def validate_exact_fields(errors, prefix, value, expected)
    return unless value.is_a?(Hash)
    missing = expected - value.keys
    extra = value.keys - expected
    errors << "#{prefix} missing fields: #{missing.join(', ')}" unless missing.empty?
    errors << "#{prefix} has unexpected fields: #{extra.join(', ')}" unless extra.empty?
  end

  def validate_non_empty_string(errors, field, value)
    errors << "#{field} must be a non-empty string" unless value.is_a?(String) && !value.strip.empty?
  end

  def validate_unique(errors, label, values)
    duplicates = values.compact.group_by(&:itself).select { |_value, entries| entries.length > 1 }.keys
    errors << "duplicate #{label}: #{duplicates.join(', ')}" unless duplicates.empty?
  end

  def validate_string_array(errors, field, value)
    unless value.is_a?(Array) && value.all? { |item| item.is_a?(String) && !item.empty? }
      errors << "#{field} must be an array of non-empty strings"
      return
    end
    errors << "#{field} contains duplicate values" unless value.uniq.length == value.length
  end

  def validate_https(errors, field, value)
    uri = URI.parse(value.to_s)
    errors << "#{field} must be an HTTPS official URI" unless uri.is_a?(URI::HTTPS) && uri.host
  rescue URI::InvalidURIError
    errors << "#{field} must be an HTTPS official URI"
  end

  def validate_date(errors, field, value, full: false, allow_partial: false)
    if value.nil? && allow_partial
      return nil
    end
    unless value.is_a?(String)
      errors << "#{field} must be an ISO date"
      return nil
    end
    if full
      return Date.iso8601(value)
    end
    if allow_partial
      return Date.new(Integer(value), 1, 1) if value.match?(/\A\d{4}\z/)
      year, month = value.split("-").map(&:to_i) if value.match?(/\A\d{4}-\d{2}\z/)
      return Date.new(year, month, 1) if year && month
    end
    Date.iso8601(value)
  rescue ArgumentError, Date::Error
    errors << "#{field} is not a possible ISO date"
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

  def projection_list(values, code: false, empty: "none")
    items = Array(values)
    return empty if items.empty?
    items.map { |value| code ? "`#{value}`" : value }.join("<br>")
  end

  def markdown_cell(value)
    value.to_s.gsub("|", "\\|").gsub("\n", "<br>")
  end
end
