#!/usr/bin/env ruby
# frozen_string_literal: true

require "pathname"
require "digest"
require "json"
require "open3"
require "set"
require "yaml"
require_relative "lib/methodology_reference_catalog"

ROOT = Pathname.new(__dir__).join("..").expand_path
NEXT_DOCS = ROOT.join("docs", "next")
LEGACY_DOCS = ROOT.join("docs")
LEGACY_MIGRATION_MAP = NEXT_DOCS.join("08_Roadmap_and_Adoption", "004_LEGACY_MIGRATION_MAP.md")
OWNER_ROLE_REGISTRY_ID = "GAEP-REG-008"
PRODUCT_DECISION_CROSSWALK = NEXT_DOCS.join("06_GAEP_On_GAEP", "011_PRODUCT_DECISION_CROSSWALK.md")
PRODUCT_STRATEGY = NEXT_DOCS.join("00_GAEP_Product_Strategy")
CORE_OPEN_DECISION_REGISTER = NEXT_DOCS.join("99_Registries_and_References", "009_CORE_OPEN_DECISION_REGISTER.md")
CORE_BOUNDARY_REGISTER = NEXT_DOCS.join("99_Registries_and_References", "010_CORE_BOUNDARY_AND_COMPLEXITY_BUDGET.md")
CORE_SPECIFICATION = NEXT_DOCS.join("02_Core_Specification")
REPOSITORY_GAP_REGISTER = NEXT_DOCS.join("06_GAEP_On_GAEP", "012_REPOSITORY_GAP_REGISTER.md")
SCENARIO_CATALOG = NEXT_DOCS.join("07_Guides_Examples_and_Scenarios", "001_REFERENCE_SCENARIO_CATALOG.md")
MIGRATION_MAP = NEXT_DOCS.join("08_Roadmap_and_Adoption", "004_LEGACY_MIGRATION_MAP.md")
MANUAL_REHEARSAL_PLAN = NEXT_DOCS.join("06_GAEP_On_GAEP", "006_MANUAL_PILOT_AND_EVIDENCE_PLAN.md")
APPLICABILITY_WORKSHEET = NEXT_DOCS.join("06_GAEP_On_GAEP", "002_APPLICABILITY_AND_SCOPE.md")
ROLE_ASSIGNMENT_RECORD = NEXT_DOCS.join("06_GAEP_On_GAEP", "009_STAKEHOLDER_AND_ROLE_ASSIGNMENT.md")
ASSURANCE_CASE = NEXT_DOCS.join("06_GAEP_On_GAEP", "005_ASSURANCE_CASE.md")
METHODOLOGY_CONSTITUTION = NEXT_DOCS.join("01_Constitution", "004_METHODOLOGY_CONSTITUTION.md")
METHODOLOGY_REFERENCE_CATALOG = NEXT_DOCS.join("99_Registries_and_References", "011_METHODOLOGY_REFERENCE_CATALOG.json")
METHODOLOGY_REFERENCE_SCHEMA = NEXT_DOCS.join("99_Registries_and_References", "011_METHODOLOGY_REFERENCE_CATALOG.schema.json")
METHODOLOGY_CROSSWALK = NEXT_DOCS.join("99_Registries_and_References", "002_EXTERNAL_STANDARDS_CROSSWALK.md")
METHODOLOGY_REFERENCE_CONTRACT = NEXT_DOCS.join("99_Registries_and_References", "003_REFERENCE_ENTRY_CONTRACT.md")
POSITIONING_AND_NAMING = NEXT_DOCS.join("00_GAEP_Product_Strategy", "004_POSITIONING_AND_ALTERNATIVES.md")
ROOT_TEXT_FILES = %w[
  .gitignore
  README.md
  CONTRIBUTING.md
  LICENSE_STATUS.md
  SECURITY.md
  CHANGELOG.md
].freeze
CRS_TOOL_FILES = %w[
  scripts/validate_next_docs.rb
  scripts/build_candidate_revision_set.rb
  scripts/lib/methodology_reference_catalog.rb
  scripts/methodology_reference_catalog.test.rb
  scripts/render_methodology_crosswalk.rb
].freeze
VALIDATION_MODES = %w[structural candidate baseline implementation-readiness].freeze
ACTIVE_CORE_IDS = %w[
  GAEP-CORE-001
  GAEP-CORE-003
  GAEP-CORE-004
  GAEP-CORE-005
  GAEP-CORE-006
  GAEP-CORE-007
  GAEP-CORE-009
  GAEP-CORE-012
].freeze
PROFILE_CONTRACT_FIELDS = [
  "Core compatibility",
  "Versioned dependencies",
  "Applicability and selection",
  "Co-selection rules",
  "Obligations",
  "Permitted variation points",
  "Authority, evidence, and cadence",
  "Conformance",
  "Compatibility and conflicts",
  "Invalidation, migration, deprecation, and expiry"
].freeze
REQUIRED_FIELDS = %w[
  id title document_type schema_version version status owner_role scope
  normative_level classification provenance approval normative_dependencies
  informative_references supersedes
].freeze

validation_mode = "structural"
manifest_path = nil
arguments = ARGV.dup
until arguments.empty?
  argument = arguments.shift
  case argument
  when "--mode"
    validation_mode = arguments.shift.to_s
  when /\A--mode=(.+)\z/
    validation_mode = Regexp.last_match(1)
  when "--manifest"
    manifest_path = arguments.shift
  when /\A--manifest=(.+)\z/
    manifest_path = Regexp.last_match(1)
  else
    warn "unknown argument: #{argument}"
    warn "usage: ruby scripts/validate_next_docs.rb [--mode #{VALIDATION_MODES.join('|')}] [--manifest PATH]"
    exit 64
  end
end

unless VALIDATION_MODES.include?(validation_mode)
  warn "unknown validation mode: #{validation_mode.inspect}"
  warn "valid modes: #{VALIDATION_MODES.join(', ')}"
  exit 64
end

errors = []
warnings = []
gate_blockers = []
documents = {}
document_metadata = {}
document_paths = {}
dependencies = {}
core_package_interfaces = {}
requirement_definitions = {}
requirement_references = Hash.new { |hash, key| hash[key] = [] }
requirement_reference_documents = Hash.new { |hash, key| hash[key] = Set.new }
document_references = Hash.new { |hash, key| hash[key] = Set.new }
document_reference_sources = Hash.new { |hash, key| hash[key] = Set.new }

document_types = %w[
  navigation product-strategy constitution principle-catalog
  normative-specification profile realization adapter-profile workspace-record
  guide scenario-catalog roadmap registry reference
].freeze
document_statuses = %w[draft proposed approved baselined deprecated retired].freeze
normative_levels = %w[normative informative mixed].freeze

files = NEXT_DOCS.glob("**/*.md").sort
data_files = NEXT_DOCS.glob("**/*.json").sort
errors << "No candidate Markdown files found under #{NEXT_DOCS}" if files.empty?

files.each do |path|
  relative = path.relative_path_from(ROOT).to_s
  text = path.read
  errors << "#{relative}: extra blank line at end of file" if text.match?(/\r?\n\r?\n\z/)

  unless text.start_with?("---\n")
    errors << "#{relative}: missing YAML front matter"
    next
  end

  closing = text.index("\n---\n", 4)
  unless closing
    errors << "#{relative}: unterminated YAML front matter"
    next
  end

  begin
    metadata = YAML.safe_load(text[4...closing], permitted_classes: [], aliases: false) || {}
  rescue Psych::SyntaxError => e
    errors << "#{relative}: invalid YAML front matter: #{e.message.lines.first.strip}"
    next
  end

  missing = REQUIRED_FIELDS.reject { |field| metadata.key?(field) }
  errors << "#{relative}: missing metadata fields: #{missing.join(', ')}" unless missing.empty?

  id = metadata["id"]
  if !id.is_a?(String) || id.empty?
    errors << "#{relative}: id must be a non-empty string"
  elsif !id.match?(/\AGAEP-[A-Z0-9]+(?:-[A-Z0-9]+)*\z/)
    errors << "#{relative}: invalid document id format #{id.inspect}"
  elsif documents.key?(id)
    errors << "duplicate document id #{id}: #{documents[id]} and #{relative}"
  else
    documents[id] = relative
    document_metadata[id] = metadata
    document_paths[relative] = id
  end

  unless metadata["approval"].is_a?(Hash) && metadata["approval"].key?("state")
    errors << "#{relative}: approval must be a mapping with state"
  end

  if metadata["approval"].is_a?(Hash)
    unless metadata["approval"]["approved_by"].is_a?(Array)
      errors << "#{relative}: approval.approved_by must be a list"
    end
    if metadata.dig("approval", "state") == "not-approved"
      errors << "#{relative}: a not-approved document cannot name approvers" unless Array(metadata.dig("approval", "approved_by")).empty?
      errors << "#{relative}: a not-approved document cannot have approved_at" unless metadata.dig("approval", "approved_at").nil?
    end
  end

  errors << "#{relative}: unknown document_type #{metadata['document_type'].inspect}" unless document_types.include?(metadata["document_type"])
  errors << "#{relative}: unknown status #{metadata['status'].inspect}" unless document_statuses.include?(metadata["status"])
  errors << "#{relative}: unknown normative_level #{metadata['normative_level'].inspect}" unless normative_levels.include?(metadata["normative_level"])
  if metadata["status"] == "proposed" && metadata.dig("approval", "state") != "not-approved"
    errors << "#{relative}: proposed document must have approval.state not-approved"
  end

  %w[normative_dependencies informative_references supersedes].each do |field|
    unless metadata[field].is_a?(Array)
      errors << "#{relative}: #{field} must be a list"
      next
    end

    non_strings = metadata[field].reject { |value| value.is_a?(String) && !value.empty? }
    errors << "#{relative}: #{field} must contain only non-empty strings" unless non_strings.empty?
    errors << "#{relative}: #{field} contains duplicate entries" unless metadata[field].uniq.length == metadata[field].length
  end

  dependencies[id] = Array(metadata["normative_dependencies"]) if id.is_a?(String)
  errors << "#{relative}: a document cannot normatively depend on itself" if Array(metadata["normative_dependencies"]).include?(id)

  if metadata.key?("core_package_interfaces")
    interfaces = metadata["core_package_interfaces"]
    unless interfaces.is_a?(Array)
      errors << "#{relative}: core_package_interfaces must be a list"
      interfaces = []
    end
    unless id.to_s.match?(/\AGAEP-CORE-\d{3}\z/)
      errors << "#{relative}: core_package_interfaces is reserved for co-versioned Core modules"
    end
    errors << "#{relative}: core_package_interfaces must contain only Core document IDs" unless interfaces.all? { |value| value.is_a?(String) && value.match?(/\AGAEP-CORE-\d{3}\z/) }
    errors << "#{relative}: core_package_interfaces contains duplicate entries" unless interfaces.uniq.length == interfaces.length
    errors << "#{relative}: a Core module cannot declare itself as an interface" if interfaces.include?(id)
    overlap = interfaces & Array(metadata["normative_dependencies"])
    errors << "#{relative}: Core interfaces duplicate normative dependencies: #{overlap.join(', ')}" unless overlap.empty?
    core_package_interfaces[id] = interfaces if id.is_a?(String)
  end

  Array(metadata["informative_references"]).each do |reference|
    next unless reference.is_a?(String)
    next if reference.match?(%r{\Ahttps?://})
    next unless reference.include?("/") || reference.end_with?(".md")

    resolved_reference = path.dirname.join(reference).cleanpath
    errors << "#{relative}: broken informative reference #{reference}" unless resolved_reference.exist?
  end

  headings = text.scan(/^# (.+)$/)
  errors << "#{relative}: expected exactly one H1, found #{headings.length}" unless headings.length == 1
  level_two_headings = text.scan(/^## (.+)$/).flatten
  duplicate_level_two = level_two_headings.group_by { |heading| heading }.select { |_heading, occurrences| occurrences.length > 1 }
  duplicate_level_two.each_key { |heading| errors << "#{relative}: duplicate H2 heading #{heading.inspect}" }
  errors << "#{relative}: unbalanced fenced code blocks" if text.scan(/^```/).length.odd?
  warnings << "#{relative}: trailing whitespace" if text.lines.any? { |line| line.match?(/[ \t]+\n$/) }

  if metadata["document_type"] == "profile"
    unless Array(metadata["normative_dependencies"]).include?("GAEP-CORE-009")
      errors << "#{relative}: a Profile must normatively depend on GAEP-CORE-009"
    end
    errors << "#{relative}: missing Profile contract section" unless text.include?("## Profile contract")
    errors << "#{relative}: missing required negative cases section" unless text.include?("## Required negative cases")
    PROFILE_CONTRACT_FIELDS.each do |field|
      errors << "#{relative}: Profile contract missing #{field.inspect}" unless text.include?("| #{field} |")
    end
  end

  text.each_line.with_index(1) do |line, line_number|
    line.scan(/\bGAEP-(?:NEXT|CST|STR|CORE|PROF|REAL|ADAPT|SELF|GUIDE|RM|REG)-\d{3}\b/).each do |document_id|
      document_references[document_id] << "#{relative}:#{line_number}"
      document_reference_sources[document_id] << relative
    end

    line.scan(/GAEP-[A-Z0-9-]+-REQ-\d+\.\.\d+/).each do |requirement_range|
      errors << "#{relative}:#{line_number}: requirement ranges are not addressable; expand #{requirement_range} into exact IDs"
    end

    line.scan(/GAEP-[A-Z0-9-]+-REQ-[A-Z0-9-]+/).each do |requirement_id|
      if (range = requirement_id.match(/\A(.+-REQ-)(\d+)-(\d+)\z/))
        errors << "#{relative}:#{line_number}: requirement ranges are not addressable; expand #{requirement_id} into exact IDs"
      else
        requirement_references[requirement_id] << "#{relative}:#{line_number}"
        requirement_reference_documents[requirement_id] << relative
      end
    end

    match = line.match(/^\|\s*(GAEP-[A-Z0-9-]+-REQ-[A-Z0-9-]+)\s*\|/)
    next unless match

    requirement_id = match[1]
    location = "#{relative}:#{line_number}"
    row = line.match(/^\|\s*(GAEP-[A-Z0-9-]+-REQ-[A-Z0-9-]+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/)
    unless row
      errors << "#{location}: requirement row must contain ID, requirement, and verification columns"
      next
    end
    unless row[2].match?(/\b(?:SHALL|SHOULD|MAY|MUST)\b/)
      errors << "#{location}: requirement text must use an explicit normative keyword"
    end
    errors << "#{location}: requirement verification must not be empty" if row[3].strip.empty?
    if metadata["normative_level"] == "informative"
      errors << "#{location}: an informative document cannot define a normative requirement"
    end
    if requirement_definitions.key?(requirement_id)
      errors << "duplicate requirement id #{requirement_id}: #{requirement_definitions[requirement_id]} and #{location}"
    else
      requirement_definitions[requirement_id] = location
    end
  end

  text.scan(/\[[^\]]*\]\(([^)]+)\)/).flatten.each do |target|
    clean = target.split("#", 2).first
    next if clean.nil? || clean.empty?
    next if clean.match?(%r{\A(?:https?|mailto):})
    next if clean.start_with?("#")

    resolved = if clean.start_with?("/")
                 Pathname.new(clean)
               else
                 path.dirname.join(clean).cleanpath
               end
    errors << "#{relative}: broken local link #{target}" unless resolved.exist?
  end
end

methodology_reference_count = 0
methodology_concern_count = 0
methodology_mapping_count = 0
methodology_deferred_count = 0
methodology_catalog_digest = nil
methodology_catalog = nil
if !METHODOLOGY_REFERENCE_CATALOG.file?
  errors << "missing Methodology Reference Catalog #{METHODOLOGY_REFERENCE_CATALOG.relative_path_from(ROOT)}"
else
  raw_catalog = METHODOLOGY_REFERENCE_CATALOG.read
  begin
    methodology_catalog = JSON.parse(raw_catalog)
  rescue JSON::ParserError => e
    errors << "#{METHODOLOGY_REFERENCE_CATALOG.relative_path_from(ROOT)}: invalid JSON: #{e.message}"
  end
  if methodology_catalog
    MethodologyReferenceCatalog.validate(methodology_catalog, raw_text: raw_catalog).each do |error|
      errors << "#{METHODOLOGY_REFERENCE_CATALOG.relative_path_from(ROOT)}: #{error}"
    end
    methodology_reference_count = Array(methodology_catalog["references"]).length
    methodology_concern_count = Array(methodology_catalog["concerns"]).length
    methodology_mapping_count = Array(methodology_catalog["mappings"]).length
    methodology_deferred_count = Array(methodology_catalog["deferredCandidates"]).length
    methodology_catalog_digest = Digest::SHA256.hexdigest(raw_catalog)
    catalog_id = methodology_catalog["catalogId"]
    catalog_relative = METHODOLOGY_REFERENCE_CATALOG.relative_path_from(ROOT).to_s
    if documents.key?(catalog_id)
      errors << "duplicate document or catalog id #{catalog_id}: #{documents[catalog_id]} and #{catalog_relative}"
    else
      documents[catalog_id] = catalog_relative
    end
  end
end

if !METHODOLOGY_REFERENCE_SCHEMA.file?
  errors << "missing Methodology Reference Catalog schema #{METHODOLOGY_REFERENCE_SCHEMA.relative_path_from(ROOT)}"
else
  begin
    schema = JSON.parse(METHODOLOGY_REFERENCE_SCHEMA.read)
    errors << "#{METHODOLOGY_REFERENCE_SCHEMA.relative_path_from(ROOT)}: wrong schema id" unless schema["$id"] == MethodologyReferenceCatalog::SCHEMA_ID
    if methodology_catalog && methodology_catalog["schemaId"] != schema["$id"]
      errors << "#{METHODOLOGY_REFERENCE_SCHEMA.relative_path_from(ROOT)}: catalog schema binding is stale"
    end
  rescue JSON::ParserError => e
    errors << "#{METHODOLOGY_REFERENCE_SCHEMA.relative_path_from(ROOT)}: invalid JSON: #{e.message}"
  end
end

if methodology_catalog && METHODOLOGY_CROSSWALK.file?
  crosswalk_text = METHODOLOGY_CROSSWALK.read
  expected_digest = "Catalog SHA-256: `#{methodology_catalog_digest}`"
  errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: catalog digest projection is stale" unless crosswalk_text.include?(expected_digest)
  errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: catalog identity projection is stale" unless crosswalk_text.include?("Catalog ID: `#{methodology_catalog['catalogId']}`")
  errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: schema identity projection is stale" unless crosswalk_text.include?("Schema ID: `#{methodology_catalog['schemaId']}`")
  errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: schema version projection is stale" unless crosswalk_text.include?("Schema version: `#{methodology_catalog['schemaVersion']}`")
  errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: catalog version projection is stale" unless crosswalk_text.include?("Catalog version: `#{methodology_catalog['version']}`")
  errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: assessed-reference count projection is stale" unless crosswalk_text.include?("Catalog assessed references: `#{methodology_reference_count}`")
  errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: concern-mapping count projection is stale" unless crosswalk_text.include?("Catalog concern mappings: `#{methodology_mapping_count}`")
  Array(methodology_catalog["references"]).each do |reference|
    reference_id = reference["referenceId"]
    errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: missing assessed reference #{reference_id}" unless crosswalk_text.include?("`#{reference_id}`")
  end
  Array(methodology_catalog["mappings"]).each do |mapping|
    concern_id = mapping["concernId"]
    errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: missing concern mapping #{concern_id}" unless crosswalk_text.match?(/^\| `#{Regexp.escape(concern_id)}` \|/)
  end
  {
    "concern crosswalk" => ["<!-- BEGIN GENERATED CONCERN CROSSWALK -->", "<!-- END GENERATED CONCERN CROSSWALK -->", MethodologyReferenceCatalog.mapping_projection(methodology_catalog)],
    "mapping governance" => ["<!-- BEGIN GENERATED MAPPING GOVERNANCE -->", "<!-- END GENERATED MAPPING GOVERNANCE -->", MethodologyReferenceCatalog.assessment_projection(methodology_catalog)],
    "reference inventory" => ["<!-- BEGIN GENERATED REFERENCE INVENTORY -->", "<!-- END GENERATED REFERENCE INVENTORY -->", MethodologyReferenceCatalog.reference_projection(methodology_catalog)]
  }.each do |label, (start_marker, end_marker, expected_projection)|
    match = crosswalk_text.match(/#{Regexp.escape(start_marker)}\n(.*?)\n#{Regexp.escape(end_marker)}/m)
    if !match
      errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: missing generated #{label} markers"
    elsif match[1] != expected_projection
      errors << "#{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}: generated #{label} projection is stale"
    end
  end
elsif !METHODOLOGY_CROSSWALK.file?
  errors << "missing Methodology Crosswalk #{METHODOLOGY_CROSSWALK.relative_path_from(ROOT)}"
end

if methodology_catalog && METHODOLOGY_CONSTITUTION.file?
  constitution_text = METHODOLOGY_CONSTITUTION.read
  Array(methodology_catalog["concerns"]).each do |concern|
    errors << "#{METHODOLOGY_CONSTITUTION.relative_path_from(ROOT)}: missing concern #{concern['concernId']}" unless constitution_text.include?(concern["concernId"])
  end
  (1..21).each do |number|
    requirement_id = format("GAEP-MTH-REQ-%03d", number)
    errors << "#{METHODOLOGY_CONSTITUTION.relative_path_from(ROOT)}: missing requirement #{requirement_id}" unless constitution_text.include?(requirement_id)
  end
else
  errors << "missing Methodology Constitution #{METHODOLOGY_CONSTITUTION.relative_path_from(ROOT)}" unless METHODOLOGY_CONSTITUTION.file?
end

if METHODOLOGY_REFERENCE_CONTRACT.file?
  claims_text = METHODOLOGY_REFERENCE_CONTRACT.read
  %w[aligned\ with informed\ by adapted\ from uses\ concepts\ from designed\ to\ support candidate\ conformance\ mapping not\ independently\ verified].each do |claim|
    phrase = claim.tr("\\", "")
    errors << "#{METHODOLOGY_REFERENCE_CONTRACT.relative_path_from(ROOT)}: missing allowed claim phrase #{phrase.inspect}" unless claims_text.downcase.include?(phrase)
  end
  %w[compliant certified guarantees eliminates enterprise-ready production-ready secure safe audit-proof regulator-approved industry\ standard superior].each do |claim|
    phrase = claim.tr("\\", "")
    errors << "#{METHODOLOGY_REFERENCE_CONTRACT.relative_path_from(ROOT)}: missing restricted claim phrase #{phrase.inspect}" unless claims_text.downcase.include?(phrase)
  end
end

if POSITIONING_AND_NAMING.file?
  naming_text = POSITIONING_AND_NAMING.read
  {
    "canonical name" => "Governed AI Engineering Platform",
    "descriptor" => "An evidence-driven, adaptive product-to-operations engineering system.",
    "tagline" => "From product intent to operational evidence.",
    "decision state" => "Proposed — awaiting explicit Product Owner acceptance",
    "drift inventory" => "## Naming drift inventory"
  }.each do |label, value|
    errors << "#{POSITIONING_AND_NAMING.relative_path_from(ROOT)}: missing naming #{label}" unless naming_text.include?(value)
  end
end


retired_requirement_ids = Set.new
core_concept_count = 0
core_extraction_count = 0
core_concept_types = []
core_concept_inventory_errors = []
declared_active_core_requirement_counts = {}
declared_initial_reconciliation_counts = {}
if CORE_BOUNDARY_REGISTER.exist?
  boundary_text = CORE_BOUNDARY_REGISTER.read
  core_concept_count = boundary_text[/^\| \*\*Total\*\* \|\s*\| \*\*(\d+)\*\* \|$/, 1].to_i
  core_extraction_count = boundary_text.scan(/^\| `GAEP-EXT-\d{3}` \|/).length
  boundary_text.scan(/^\| (GAEP-CORE-\d{3}) \| [^|]+ \| (\d+) \| within 24 \|$/).each do |document_id, count|
    declared_active_core_requirement_counts[document_id] = count.to_i
  end
  boundary_text.scan(/^\| (Retained active Core|Reclassified with GAEP-CORE-010|Reclassified with GAEP-CORE-011|Omitted former Core IDs) \| [^|]+ \| (\d+) \|/).each do |reconciliation_class, count|
    declared_initial_reconciliation_counts[reconciliation_class] = count.to_i
  end
  concept_sections = boundary_text.split(/^## Canonical Core entity inventory\s*$/, 2)
  if concept_sections.length == 2
    concept_body = concept_sections.last.split(/^##\s+/, 2).first
    concept_body.lines.grep(/^\| [^|]+ \| [^|]+ \| \d+ \|$/).each do |row|
      fields = row.split("|").map(&:strip).reject(&:empty?)
      types = fields[1].split(";").map(&:strip).reject(&:empty?)
      declared_count = fields[2].to_i
      core_concept_inventory_errors << "Core concept inventory row count mismatch for #{fields[0]}" unless types.length == declared_count
      core_concept_types.concat(types)
    end
  else
    core_concept_inventory_errors << "missing Canonical Core entity inventory section"
  end
  disposition_sections = boundary_text.split(/^## Requirement disposition register\s*$/, 2)
  if disposition_sections.length == 2
    disposition_body = disposition_sections.last.split(/^##\s+/, 2).first
    disposition_rows = disposition_body.lines.grep(/^\|\s*GAEP-RD-\d+\s*\|/)
    disposition_rows.each do |row|
      fields = row.split("|").map(&:strip)
      former_ids = fields.fetch(2, "").scan(/GAEP-[A-Z0-9-]+-REQ-[A-Z0-9-]+/)
      if former_ids.empty?
        errors << "#{CORE_BOUNDARY_REGISTER.relative_path_from(ROOT)}: disposition row has no exact former requirement ID: #{row.strip}"
      end
      former_ids.each do |requirement_id|
        if retired_requirement_ids.include?(requirement_id)
          errors << "#{CORE_BOUNDARY_REGISTER.relative_path_from(ROOT)}: duplicate former requirement disposition #{requirement_id}"
        else
          retired_requirement_ids << requirement_id
        end
      end
    end
  else
    errors << "#{CORE_BOUNDARY_REGISTER.relative_path_from(ROOT)}: missing Requirement disposition register section"
  end
else
  errors << "missing Core Boundary Register #{CORE_BOUNDARY_REGISTER.relative_path_from(ROOT)}"
end

requirement_references.each do |requirement_id, locations|
  next if requirement_definitions.key?(requirement_id)
  next if retired_requirement_ids.include?(requirement_id)

  errors << "undefined requirement reference #{requirement_id}: #{locations.first}"
end

document_references.each do |document_id, locations|
  next if documents.key?(document_id)

  errors << "undefined candidate document reference #{document_id}: #{locations.first}"
end

document_reference_sources.each do |target_id, source_relatives|
  next unless target_id.match?(/\AGAEP-CORE-\d{3}\z/)

  source_relatives.each do |source_relative|
    source_id = document_paths[source_relative]
    next unless source_id&.match?(/\AGAEP-CORE-\d{3}\z/)
    next if document_metadata.dig(source_id, "normative_level") == "informative"
    next if source_id == target_id
    declared = Array(dependencies[source_id]) + Array(core_package_interfaces[source_id])
    next if declared.include?(target_id)

    errors << "#{source_relative}: Core reference #{target_id} is neither a normative dependency nor a core_package_interface"
  end
end

requirement_reference_documents.each do |requirement_id, source_documents|
  definition = requirement_definitions[requirement_id]
  next unless definition

  definition_relative = definition.sub(/:\d+\z/, "")
  owner_id = document_paths[definition_relative]
  source_documents.each do |source_relative|
    next if source_relative == definition_relative

    source_id = document_paths[source_relative]
    next unless source_id
    next if document_metadata.dig(source_id, "normative_level") == "informative"
    next if Array(dependencies[source_id]).include?(owner_id)

    errors << "#{source_relative}: references #{requirement_id} without normative dependency #{owner_id}"
  end
end

dependencies.each do |source, targets|
  targets.each do |target|
    errors << "#{documents[source] || source}: missing normative dependency #{target}" unless documents.key?(target)
    if documents.key?(target) && document_metadata.dig(target, "normative_level") == "informative"
      errors << "#{documents[source] || source}: normative dependency #{target} points to an informative document"
    end
  end
end

core_package_interfaces.each do |source, targets|
  targets.each do |target|
    errors << "#{documents[source] || source}: missing Core package interface #{target}" unless documents.key?(target)
  end
end

if LEGACY_MIGRATION_MAP.exist?
  migration_text = LEGACY_MIGRATION_MAP.read
  legacy_files = LEGACY_DOCS.glob("**/*.md").reject { |path| path.to_s.start_with?(NEXT_DOCS.to_s + File::SEPARATOR) }
  legacy_files.each do |path|
    legacy_relative = path.relative_path_from(LEGACY_DOCS).to_s
    unless migration_text.include?("`#{legacy_relative}`")
      errors << "#{LEGACY_MIGRATION_MAP.relative_path_from(ROOT)}: missing legacy document #{legacy_relative}"
    end
  end
else
  errors << "missing legacy migration map #{LEGACY_MIGRATION_MAP.relative_path_from(ROOT)}"
end

if documents.key?(OWNER_ROLE_REGISTRY_ID)
  owner_registry_text = ROOT.join(documents[OWNER_ROLE_REGISTRY_ID]).read
  document_metadata.each do |id, metadata|
    role = metadata["owner_role"]
    registered = role.is_a?(String) && (
      owner_registry_text.include?("| #{role} |") || owner_registry_text.include?("| `#{role}` |")
    )
    next if registered

    errors << "#{documents[id]}: owner_role #{role.inspect} is absent from the owner-role registry"
  end
else
  warnings << "owner-role registry document #{OWNER_ROLE_REGISTRY_ID} not found"
end

if PRODUCT_DECISION_CROSSWALK.exist?
  source_decisions = Set.new
  PRODUCT_STRATEGY.glob("*.md").each do |path|
    path.read.scan(/GAEP-STR-[A-Z0-9-]+-DEC-[A-Z0-9-]+/) { |id| source_decisions << id }
  end
  crosswalk_text = PRODUCT_DECISION_CROSSWALK.read
  source_decisions.each do |id|
    errors << "#{PRODUCT_DECISION_CROSSWALK.relative_path_from(ROOT)}: missing Product Strategy decision #{id}" unless crosswalk_text.include?(id)
  end
else
  errors << "missing Product Decision Crosswalk #{PRODUCT_DECISION_CROSSWALK.relative_path_from(ROOT)}"
end

core_open_decision_count = 0
registered_statuses = {}
classification_tiers = {}
deferral_policy_tiers = {}
if CORE_OPEN_DECISION_REGISTER.exist?
  source_open_decisions = Set.new
  CORE_SPECIFICATION.glob("*.md").each do |path|
    path.read.scan(/GAEP-[A-Z0-9-]+-OD-\d{3}/) { |id| source_open_decisions << id }
  end
  open_decision_text = CORE_OPEN_DECISION_REGISTER.read
  open_decision_sections = open_decision_text.split(/^## Register\s*$/, 2)
  if open_decision_sections.length == 2
    open_decision_register_body = open_decision_sections.last.split(/^##\s+/, 2).first
    registered_open_decision_rows = open_decision_register_body.lines.grep(/^\|\s*GAEP-[A-Z0-9-]+-OD-\d{3}\s*\|/)
    registered_open_decisions = registered_open_decision_rows.map do |row|
      row[/^\|\s*(GAEP-[A-Z0-9-]+-OD-\d{3})\s*\|/, 1]
    end
  else
    errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: missing Register section"
    registered_open_decision_rows = []
    registered_open_decisions = []
  end
  duplicate_open_decisions = registered_open_decisions.group_by { |id| id }.select { |_id, entries| entries.length > 1 }
  duplicate_open_decisions.each_key do |id|
    errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: duplicate Core Open Decision #{id}"
  end
  registered_set = registered_open_decisions.to_set
  (source_open_decisions - registered_set).each do |id|
    errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: missing Core Open Decision #{id}"
  end
  (registered_set - source_open_decisions).each do |id|
    errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: orphan Core Open Decision #{id}"
  end

  registered_statuses = registered_open_decision_rows.to_h do |row|
    fields = row.split("|").map(&:strip).reject(&:empty?)
    [fields[0], fields[5]]
  end
  conflicting_registered = registered_statuses.select { |_id, status| status == "open-conflicts-with-current-contract" }.keys.to_set
  assumption_sections = open_decision_text.split(/^## Current normative assumptions that still require decisions\s*$/, 2)
  if assumption_sections.length == 2
    assumption_body = assumption_sections.last.split(/^##\s+/, 2).first
    assumption_ids = assumption_body.scan(/^\|\s*(GAEP-[A-Z0-9-]+-OD-\d{3})\s*\|/).flatten
    duplicate_assumption_ids = assumption_ids.group_by { |id| id }.select { |_id, entries| entries.length > 1 }
    duplicate_assumption_ids.each_key do |id|
      errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: duplicate current-assumption row #{id}"
    end
    assumption_set = assumption_ids.to_set
    (conflicting_registered - assumption_set).each do |id|
      errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: missing current normative assumption for #{id}"
    end
    (assumption_set - conflicting_registered).each do |id|
      errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: current-assumption row #{id} is not registered with conflicting status"
    end
  else
    errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: missing current normative assumptions section"
  end

  classification_sections = open_decision_text.split(/^## Decision criticality and gate classification\s*$/, 2)
  if classification_sections.length == 2
    classification_body = classification_sections.last.split(/^##\s+/, 2).first
    classification_rows = classification_body.lines.grep(/^\|\s*GAEP-[A-Z0-9-]+-OD-\d{3}\s*\|/)
    classified_decisions = classification_rows.map do |row|
      row[/^\|\s*(GAEP-[A-Z0-9-]+-OD-\d{3})\s*\|/, 1]
    end
    duplicate_classifications = classified_decisions.group_by { |id| id }.select { |_id, entries| entries.length > 1 }
    duplicate_classifications.each_key do |id|
      errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: duplicate criticality classification #{id}"
    end
    classification_set = classified_decisions.to_set
    (registered_set - classification_set).each do |id|
      errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: missing criticality classification #{id}"
    end
    (classification_set - registered_set).each do |id|
      errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: orphan criticality classification #{id}"
    end
    classification_rows.each do |row|
      fields = row.split("|").map(&:strip).reject(&:empty?)
      decision_id = fields[0]
      errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: invalid criticality tier for #{decision_id}" unless fields[1]&.match?(/\AT[0-3]\b/)
      errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: incomplete criticality classification for #{decision_id}" unless fields.length == 5 && fields.drop(2).all? { |field| !field.empty? }
      classification_tiers[decision_id] = fields[1].to_s.split.first
    end
  else
    errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: missing Decision criticality and gate classification section"
  end
  open_decision_text.scan(/^\| (D[0-3]) \| (T[0-3]) \|/).each do |policy, tier|
    if deferral_policy_tiers.key?(policy)
      errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: duplicate deferral policy #{policy}"
    else
      deferral_policy_tiers[policy] = tier
    end
  end
  expected_deferral_policy_tiers = { "D0" => "T0", "D1" => "T1", "D2" => "T2", "D3" => "T3" }
  unless deferral_policy_tiers == expected_deferral_policy_tiers
    errors << "#{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}: deferral-policy mapping mismatch: expected #{expected_deferral_policy_tiers}, got #{deferral_policy_tiers}"
  end
  core_open_decision_count = source_open_decisions.length
else
  errors << "missing Core Open Decision Register #{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}"
end

repository_gap_count = 0
repository_gap_severity_counts = Hash.new(0)
repository_gap_status_counts = Hash.new(0)
if REPOSITORY_GAP_REGISTER.exist?
  repository_gap_rows = REPOSITORY_GAP_REGISTER.read.lines.grep(/^\|\s*GAEP-GAP-\d{3}\s*\|/)
  registered_gaps = repository_gap_rows.map { |row| row[/^\|\s*(GAEP-GAP-\d{3})\s*\|/, 1] }
  duplicate_gaps = registered_gaps.group_by { |id| id }.select { |_id, entries| entries.length > 1 }
  duplicate_gaps.each_key do |id|
    errors << "#{REPOSITORY_GAP_REGISTER.relative_path_from(ROOT)}: duplicate repository gap #{id}"
  end
  repository_gap_count = registered_gaps.uniq.length
  repository_gap_rows.each do |row|
    fields = row.split("|").map(&:strip).reject(&:empty?)
    if fields.length != 8
      errors << "#{REPOSITORY_GAP_REGISTER.relative_path_from(ROOT)}: incomplete repository gap row #{fields.first}"
      next
    end
    repository_gap_severity_counts[fields[1]] += 1
    repository_gap_status_counts[fields[7]] += 1
  end
else
  errors << "missing Repository Gap Register #{REPOSITORY_GAP_REGISTER.relative_path_from(ROOT)}"
end

active_core_ids = document_metadata.each_with_object([]) do |(id, metadata), result|
  relative = documents[id]
  next unless relative&.start_with?("docs/next/02_Core_Specification/")
  next unless metadata["document_type"] == "normative-specification"
  next if metadata["status"] == "retired" || metadata["normative_level"] == "informative"

  result << id
end.sort

active_core_requirement_counts = Hash.new(0)
requirement_definitions.each_value do |location|
  relative = location.sub(/:\d+\z/, "")
  owner_id = document_paths[relative]
  active_core_requirement_counts[owner_id] += 1 if active_core_ids.include?(owner_id)
end
active_core_requirement_count = active_core_requirement_counts.values.sum
active_core_maximum = active_core_requirement_counts.values.max || 0
initial_core_realization_ids = %w[GAEP-CORE-010 GAEP-CORE-011]
initial_core_realization_requirement_counts = initial_core_realization_ids.to_h { |id| [id, 0] }
requirement_definitions.each_value do |location|
  relative = location.sub(/:\d+\z/, "")
  owner_id = document_paths[relative]
  initial_core_realization_requirement_counts[owner_id] += 1 if initial_core_realization_requirement_counts.key?(owner_id)
end
initial_core_source_requirement_count = active_core_requirement_count + initial_core_realization_requirement_counts.values.sum + retired_requirement_ids.length
profile_count = document_metadata.count { |_id, metadata| metadata["document_type"] == "profile" }
profile_requirement_count = requirement_definitions.count do |_requirement_id, location|
  relative = location.sub(/:\d+\z/, "")
  owner_id = document_paths[relative]
  document_metadata.dig(owner_id, "document_type") == "profile"
end
paper_scenario_result_count = SCENARIO_CATALOG.exist? ? SCENARIO_CATALOG.read.scan(/^\| S(?:0[1-9]|[12]\d|3[0-6]) \| paper-[^|]+ \|/).length : 0
paper_scenario_outcomes = Hash.new(0)
if SCENARIO_CATALOG.exist?
  SCENARIO_CATALOG.read.scan(/^\| S(?:0[1-9]|[12]\d|3[0-6]) \| (paper-(?:pass|pass-with-blocker|inconclusive)) \|/).flatten.each do |outcome|
    paper_scenario_outcomes[outcome] += 1
  end
end
migration_rehearsal_case_count = MIGRATION_MAP.exist? ? MIGRATION_MAP.read.scan(/^\| M0[1-7] [^|]*\|/).length : 0
manual_rehearsal_step_count = if MANUAL_REHEARSAL_PLAN.exist?
                                MANUAL_REHEARSAL_PLAN.read.scan(/^\| (?:[1-9]|10)\. [^|]+\|/).length
                              else
                                0
                              end

semantic_input_paths = (
  CORE_SPECIFICATION.glob("*.md") +
  NEXT_DOCS.join("03_Profiles").glob("*.md") +
  NEXT_DOCS.join("04_Realizations").glob("*.md") +
  NEXT_DOCS.join("05_Adapters").glob("*.md") +
  NEXT_DOCS.join("99_Registries_and_References").glob("00[5-9]_*.md") +
  NEXT_DOCS.join("99_Registries_and_References").glob("010_*.md") +
  [SCENARIO_CATALOG, MIGRATION_MAP, MANUAL_REHEARSAL_PLAN]
).uniq.sort

normalized_semantic_inputs = {}
semantic_input_paths.each do |path|
  text = path.binread
  if path == SCENARIO_CATALOG
    text = text.split(/^## Paper execution GAEP-PAPER-001\s*$/, 2).first
  elsif path == MIGRATION_MAP
    text = text.sub(/^## Reversible migration rehearsal GAEP-MIG-REH-001\s*$.*?(?=^## Migration gates\s*$)/m, "")
  elsif path == MANUAL_REHEARSAL_PLAN
    text = text.split(/^## GAEP-on-GAEP rehearsal GAEP-SELF-REH-001\s*$/, 2).first
  end
  normalized_semantic_inputs[path] = Digest::SHA256.hexdigest(text)
end
semantic_input_lines = normalized_semantic_inputs.sort_by { |path, _digest| path.to_s }.map do |path, digest|
  "#{digest}  #{path.relative_path_from(ROOT)}\n"
end
semantic_input_digest = Digest::SHA256.hexdigest(semantic_input_lines.join)
decision_tier_counts = Hash.new(0)
classification_tiers.each_value { |tier| decision_tier_counts[tier] += 1 }
stale_declared_count_findings = 0

candidate_checks_enabled = validation_mode != "structural"
if candidate_checks_enabled
  unless active_core_ids == ACTIVE_CORE_IDS.sort
    errors << "active Core contract set mismatch: expected #{ACTIVE_CORE_IDS.sort.join(', ')}, got #{active_core_ids.join(', ')}"
  end
  errors << "active Core contract budget mismatch: expected 8, got #{active_core_ids.length}" unless active_core_ids.length == 8
  errors << "active Core requirement budget mismatch: expected 160, got #{active_core_requirement_count}" unless active_core_requirement_count == 160
  errors << "active Core per-contract budget exceeded: maximum #{active_core_maximum}, budget 24" if active_core_maximum > 24
  actual_active_core_counts = active_core_ids.each_with_object({}) do |document_id, result|
    result[document_id] = active_core_requirement_counts[document_id]
  end
  unless declared_active_core_requirement_counts == actual_active_core_counts
    errors << "active Core inventory counts are stale: declared #{declared_active_core_requirement_counts}, actual #{actual_active_core_counts}"
    stale_declared_count_findings += 1
  end
  errors << "Core concept inventory mismatch: expected 48, got #{core_concept_count}" unless core_concept_count == 48
  errors.concat(core_concept_inventory_errors)
  errors << "Core concept inventory item count mismatch: expected 48, got #{core_concept_types.length}" unless core_concept_types.length == 48
  duplicate_core_concepts = core_concept_types.group_by { |concept| concept }.select { |_concept, entries| entries.length > 1 }
  duplicate_core_concepts.each_key { |concept| errors << "duplicate Core concept inventory item #{concept}" }
  errors << "Core extraction register mismatch: expected 13, got #{core_extraction_count}" unless core_extraction_count == 13
  errors << "former Core requirement disposition count mismatch: expected 135, got #{retired_requirement_ids.length}" unless retired_requirement_ids.length == 135
  expected_initial_core_realization_counts = { "GAEP-CORE-010" => 28, "GAEP-CORE-011" => 30 }
  unless initial_core_realization_requirement_counts == expected_initial_core_realization_counts
    errors << "initial Core-source Realization recount mismatch: expected #{expected_initial_core_realization_counts}, got #{initial_core_realization_requirement_counts}"
  end
  errors << "initial Core-source requirement reconciliation mismatch: expected 353, got #{initial_core_source_requirement_count}" unless initial_core_source_requirement_count == 353
  expected_declared_reconciliation_counts = {
    "Retained active Core" => 160,
    "Reclassified with GAEP-CORE-010" => 28,
    "Reclassified with GAEP-CORE-011" => 30,
    "Omitted former Core IDs" => 135
  }
  unless declared_initial_reconciliation_counts == expected_declared_reconciliation_counts
    errors << "initial Core-source reconciliation table is stale: declared #{declared_initial_reconciliation_counts}, expected #{expected_declared_reconciliation_counts}"
    stale_declared_count_findings += 1
  end
  retired_still_defined = retired_requirement_ids & requirement_definitions.keys.to_set
  unless retired_still_defined.empty?
    errors << "retired former requirement IDs remain actively defined: #{retired_still_defined.to_a.sort.join(', ')}"
  end
  boundary_relative = CORE_BOUNDARY_REGISTER.relative_path_from(ROOT).to_s
  retired_requirement_ids.each do |requirement_id|
    external_sources = requirement_reference_documents[requirement_id].reject { |relative| relative == boundary_relative }
    unless external_sources.empty?
      errors << "retired former requirement #{requirement_id} is referenced outside its disposition register: #{external_sources.to_a.sort.join(', ')}"
    end
  end
  historical_reference_exceptions = %w[GAEP-REG-009 GAEP-REG-010]
  document_metadata.each do |id, metadata|
    next if metadata["status"] == "retired" || metadata["normative_level"] == "informative"
    next if historical_reference_exceptions.include?(id)

    text = ROOT.join(documents.fetch(id)).read
    %w[GAEP-CORE-002 GAEP-CORE-008].each do |retired_id|
      if text.match?(/\b#{Regexp.escape(retired_id)}\b/)
        errors << "#{documents.fetch(id)}: active normative content references retired semantic owner #{retired_id}"
      end
    end
  end
  errors << "Profile inventory mismatch: expected 19, got #{profile_count}" unless profile_count == 19
  errors << "Profile requirement recount mismatch: expected 244, got #{profile_requirement_count}" unless profile_requirement_count == 244
  errors << "paper scenario execution coverage mismatch: expected 36, got #{paper_scenario_result_count}" unless paper_scenario_result_count == 36
  expected_paper_outcomes = { "paper-pass" => 21, "paper-pass-with-blocker" => 11, "paper-inconclusive" => 4 }
  errors << "paper scenario outcome distribution mismatch: expected #{expected_paper_outcomes}, got #{paper_scenario_outcomes}" unless paper_scenario_outcomes == expected_paper_outcomes
  errors << "migration rehearsal coverage mismatch: expected 7, got #{migration_rehearsal_case_count}" unless migration_rehearsal_case_count == 7
  errors << "GAEP-on-GAEP rehearsal coverage mismatch: expected 10, got #{manual_rehearsal_step_count}" unless manual_rehearsal_step_count == 10
  expected_tier_counts = { "T0" => 18, "T1" => 29, "T2" => 19, "T3" => 4 }
  errors << "Core Decision tier distribution mismatch: expected #{expected_tier_counts}, got #{decision_tier_counts}" unless decision_tier_counts == expected_tier_counts
  errors << "repository gap count mismatch: expected 50, got #{repository_gap_count}" unless repository_gap_count == 50
  expected_gap_severity_counts = { "blocker" => 22, "high" => 26, "medium" => 2 }
  errors << "repository gap severity distribution mismatch: expected #{expected_gap_severity_counts}, got #{repository_gap_severity_counts}" unless repository_gap_severity_counts == expected_gap_severity_counts
  expected_gap_status_counts = { "open-blocker" => 6, "open-needs-assignment" => 4, "open-needs-decision" => 11, "open-needs-evidence" => 15, "open-needs-validation" => 2, "resolved-by-candidate-structure" => 12 }
  errors << "repository gap status distribution mismatch: expected #{expected_gap_status_counts}, got #{repository_gap_status_counts}" unless repository_gap_status_counts == expected_gap_status_counts
  errors << "semantic rehearsal subject-file count mismatch: expected 47, got #{semantic_input_paths.length}" unless semantic_input_paths.length == 47

  scenario_text = SCENARIO_CATALOG.read
  declared_semantic_digest = scenario_text[/deterministic aggregate SHA-256 `([0-9a-f]{64})`/, 1]
  errors << "semantic rehearsal subject digest mismatch: expected #{declared_semantic_digest.inspect}, got #{semantic_input_digest}" unless declared_semantic_digest == semantic_input_digest
  declared_scenario_digest = scenario_text[/Normalized catalog SHA-256 `([0-9a-f]{64})`/, 1]
  errors << "normalized scenario-catalog digest mismatch" unless declared_scenario_digest == normalized_semantic_inputs[SCENARIO_CATALOG]
  declared_migration_digest = MIGRATION_MAP.read[/normalized migration-map input SHA-256 is `([0-9a-f]{64})`/i, 1]
  errors << "normalized migration-map digest mismatch" unless declared_migration_digest == normalized_semantic_inputs[MIGRATION_MAP]
  declared_manual_digest = MANUAL_REHEARSAL_PLAN.read[/normalized plan SHA-256 is `([0-9a-f]{64})`/i, 1]
  errors << "normalized manual-rehearsal-plan digest mismatch" unless declared_manual_digest == normalized_semantic_inputs[MANUAL_REHEARSAL_PLAN]
end

manifest = nil
if manifest_path
  resolved_manifest_path = Pathname.new(manifest_path)
  resolved_manifest_path = ROOT.join(resolved_manifest_path) unless resolved_manifest_path.absolute?
  if !resolved_manifest_path.file?
    errors << "Candidate Revision Set manifest not found: #{manifest_path}"
  else
    begin
      manifest = JSON.parse(resolved_manifest_path.read)
    rescue JSON::ParserError => e
      errors << "Candidate Revision Set manifest is invalid JSON: #{e.message}"
    end
  end

  if manifest
    errors << "Candidate Revision Set manifest has wrong record_type" unless manifest["record_type"] == "candidate-revision-set-manifest"
    errors << "Candidate Revision Set manifest has invalid designation" unless %w[draft-working-tree-snapshot candidate-revision-set].include?(manifest["designation"])
    errors << "Candidate Revision Set manifest candidate_set_id must be non-empty" if manifest["candidate_set_id"].to_s.strip.empty?
    errors << "Candidate Revision Set manifest purpose must be non-empty" if manifest["purpose"].to_s.strip.empty?
    errors << "Candidate Revision Set manifest owner_role must be non-empty" if manifest["owner_role"].to_s.strip.empty?
    errors << "Candidate Revision Set manifest approval_state must remain not-approved" unless manifest["approval_state"] == "not-approved"
    %w[authority_effect baseline_effect implementation_effect].each do |effect|
      errors << "Candidate Revision Set manifest #{effect} must remain none" unless manifest[effect] == "none"
    end
    membership = manifest["membership"]
    if !membership.is_a?(Hash) || !membership["members"].is_a?(Array)
      errors << "Candidate Revision Set manifest membership must contain a members list"
    else
      members = membership["members"]
      member_paths = members.map { |member| member.is_a?(Hash) ? member["path"] : nil }
      invalid_member_paths = member_paths.reject { |path| path.is_a?(String) && !path.empty? && !Pathname.new(path).absolute? && !path.split(File::SEPARATOR).include?("..") }
      errors << "Candidate Revision Set manifest contains invalid member paths" unless invalid_member_paths.empty?
      duplicates = member_paths.compact.group_by { |path| path }.select { |_path, entries| entries.length > 1 }
      duplicates.each_key { |path| errors << "Candidate Revision Set manifest contains duplicate member #{path}" }

      expected_members = (ROOT_TEXT_FILES + files.map { |path| path.relative_path_from(ROOT).to_s } + data_files.map { |path| path.relative_path_from(ROOT).to_s } + CRS_TOOL_FILES).uniq.sort
      actual_members = member_paths.compact.sort
      missing_members = expected_members - actual_members
      extra_members = actual_members - expected_members
      errors << "Candidate Revision Set manifest missing members: #{missing_members.join(', ')}" unless missing_members.empty?
      errors << "Candidate Revision Set manifest has unexpected members: #{extra_members.join(', ')}" unless extra_members.empty?

      members.each do |member|
        next unless member.is_a?(Hash) && member["path"].is_a?(String)

        path = ROOT.join(member["path"]).cleanpath
        if !path.to_s.start_with?(ROOT.to_s + File::SEPARATOR) || !path.file?
          errors << "Candidate Revision Set member missing from repository: #{member['path']}"
          next
        end
        actual_digest = Digest::SHA256.file(path).hexdigest
        errors << "Candidate Revision Set member digest mismatch: #{member['path']}" unless member["sha256"] == actual_digest
        errors << "Candidate Revision Set member byte count mismatch: #{member['path']}" unless member["bytes"] == path.size
      end

      digest_lines = members.select { |member| member.is_a?(Hash) && member["path"].is_a?(String) && member["sha256"].is_a?(String) }
                            .sort_by { |member| member["path"] }
                            .map { |member| "#{member['sha256']}  #{member['path']}\n" }
      calculated_digest = Digest::SHA256.hexdigest(digest_lines.join)
      errors << "Candidate Revision Set membership digest mismatch" unless membership["digest"] == "sha256:#{calculated_digest}"
      errors << "Candidate Revision Set member_count mismatch" unless membership["member_count"] == members.length
      errors << "Candidate Revision Set set_revision mismatch" unless manifest["set_revision"] == "sha256:#{calculated_digest}"
    end

    repository = manifest["repository"]
    if !repository.is_a?(Hash)
      errors << "Candidate Revision Set manifest repository must be a mapping"
    else
      current_head, head_error, head_status = Open3.capture3("git", "rev-parse", "HEAD", chdir: ROOT.to_s)
      current_branch, branch_error, branch_status = Open3.capture3("git", "branch", "--show-current", chdir: ROOT.to_s)
      unless head_status.success?
        errors << "cannot resolve current Git commit while validating manifest: #{head_error.strip}"
      end
      unless branch_status.success?
        errors << "cannot resolve current Git branch while validating manifest: #{branch_error.strip}"
      end
      errors << "Candidate Revision Set storage_commit mismatch" if head_status.success? && repository["storage_commit"] != current_head.strip
      errors << "Candidate Revision Set branch mismatch" if branch_status.success? && repository["branch"] != current_branch.strip
    end
  end
end

authority_blockers = []
if ROLE_ASSIGNMENT_RECORD.exist?
  role_text = ROLE_ASSIGNMENT_RECORD.read
  if role_text.include?("No proposed assignment is currently effective")
    authority_blockers << "proposed Role Assignments are not accepted or effective and no standing Authority Grant exists"
  end
  if role_text.include?("Candidate Baseline Approver") && role_text.include?("GAEP Independent Reviewer") && role_text.include?("GAEP Assurance Authority")
    authority_blockers << "Candidate Baseline Approver, GAEP Independent Reviewer, and GAEP Assurance Authority remain unassigned"
  end
end

baseline_checks_enabled = %w[baseline implementation-readiness].include?(validation_mode)
if baseline_checks_enabled
  if manifest.nil?
    gate_blockers << "no exact Candidate Revision Set manifest was supplied with --manifest"
  elsif manifest["designation"] != "candidate-revision-set"
    gate_blockers << "the supplied manifest is not designated candidate-revision-set"
  elsif manifest.dig("repository", "worktree_clean") != true
    gate_blockers << "the supplied Candidate Revision Set was not assembled from a clean worktree"
  end
  if manifest && manifest["designation"] == "candidate-revision-set"
    current_status, status_error, status_result = Open3.capture3("git", "status", "--porcelain=v1", "--untracked-files=all", chdir: ROOT.to_s)
    if !status_result.success?
      errors << "cannot inspect worktree cleanliness for formal manifest: #{status_error.strip}"
    elsif !current_status.empty?
      gate_blockers << "the current worktree is not clean for exact formal-manifest verification"
    end
  end

  unresolved_tier_zero = classification_tiers.select do |decision_id, tier|
    tier == "T0" && registered_statuses[decision_id] != "decided"
  end.keys
  gate_blockers << "#{unresolved_tier_zero.length} Tier 0 Core Decisions remain unresolved" unless unresolved_tier_zero.empty?

  approved_deferrals = registered_statuses.count { |_id, status| status == "deferred" }
  unresolved_non_tier_zero = classification_tiers.count do |decision_id, tier|
    tier != "T0" && !%w[decided deferred].include?(registered_statuses[decision_id])
  end
  if unresolved_non_tier_zero.positive?
    gate_blockers << "#{unresolved_non_tier_zero} Tier 1-3 Decisions remain open without approved bounded deferrals (approved deferrals: #{approved_deferrals})"
  end

  if APPLICABILITY_WORKSHEET.exist? && APPLICABILITY_WORKSHEET.read.include?("Resolution completion: `unresolved`")
    gate_blockers << "Profile applicability and effective configuration remain unresolved"
  end
  gate_blockers.concat(authority_blockers)
  if ASSURANCE_CASE.exist? && ASSURANCE_CASE.read.include?("The current argument therefore has no supported path to `GAEP-CLAIM-000`")
    gate_blockers << "the Assurance Case has no supported path to its top claim"
  end
  inconclusive_scenarios = SCENARIO_CATALOG.exist? ? SCENARIO_CATALOG.read.scan(/^\| S\d{2} \| paper-inconclusive \|/).length : 0
  gate_blockers << "#{inconclusive_scenarios} paper scenarios remain inconclusive and no independent execution exists" if inconclusive_scenarios.positive?
  open_gap_blockers = if REPOSITORY_GAP_REGISTER.exist?
                        REPOSITORY_GAP_REGISTER.read.scan(/^\| GAEP-GAP-\d{3} \|.*\| open-blocker \|$/).length
                      else
                        0
                      end
  gate_blockers << "#{open_gap_blockers} repository gaps remain registered as open blockers" if open_gap_blockers.positive?
end

if validation_mode == "implementation-readiness"
  gate_blockers << "no approved first product form, target segment, distribution mode, or evidence-selected workflow exists"
  gate_blockers << "no authorized participant Product and non-Product pilots or repeat-value evidence exist"
  gate_blockers << "no approved smallest implementation-slice charter, build/buy/compose decision, funding, team, support, or kill criteria exist"
  gate_blockers << "no acceptable Implementation Readiness Gate Evaluation exists"
  gate_blockers << "no Implementation Approval Case, Approval Determination, or Authorization Grant exists"
end

visiting = Set.new
visited = Set.new
stack = []

visit = lambda do |node|
  return if visited.include?(node)

  if visiting.include?(node)
    cycle_start = stack.index(node) || 0
    errors << "normative dependency cycle: #{(stack[cycle_start..] + [node]).join(' -> ')}"
    return
  end

  visiting << node
  stack << node
  Array(dependencies[node]).each { |target| visit.call(target) if documents.key?(target) }
  stack.pop
  visiting.delete(node)
  visited << node
end

documents.each_key { |id| visit.call(id) }

ROOT_TEXT_FILES.each do |relative|
  path = ROOT.join(relative)
  unless path.exist?
    errors << "missing root text file #{relative}"
    next
  end

  text = path.read
  errors << "#{relative}: extra blank line at end of file" if text.match?(/\r?\n\r?\n\z/)
  next unless path.extname == ".md"

  text.scan(/\[[^\]]*\]\(([^)]+)\)/).flatten.each do |target|
    clean = target.split("#", 2).first
    next if clean.nil? || clean.empty?
    next if clean.match?(%r{\A(?:https?|mailto):})
    next if clean.start_with?("#")

    resolved = clean.start_with?("/") ? Pathname.new(clean) : path.dirname.join(clean).cleanpath
    errors << "#{relative}: broken local link #{target}" unless resolved.exist?
  end
end

puts "GAEP Next documentation validation"
puts "mode: #{validation_mode}"
puts "documents: #{files.length}"
puts "document ids: #{documents.length}"
puts "requirement definitions: #{requirement_definitions.length}"
puts "active Core contracts: #{active_core_ids.length}"
puts "active Core requirements: #{active_core_requirement_count}"
puts "largest active Core contract: #{active_core_maximum}"
puts "Core concept inventory: #{core_concept_count}"
puts "unique Core concept inventory items: #{core_concept_types.uniq.length}"
puts "Core extraction rows: #{core_extraction_count}"
puts "former Core requirement dispositions: #{retired_requirement_ids.length}"
puts "initial Core-source Realization requirements: #{initial_core_realization_requirement_counts.sort.to_h}"
puts "initial Core-source requirements reconciled: #{initial_core_source_requirement_count}"
puts "Profiles: #{profile_count}"
puts "Profile requirements: #{profile_requirement_count}"
puts "legacy documents mapped: #{LEGACY_DOCS.glob('**/*.md').count { |path| !path.to_s.start_with?(NEXT_DOCS.to_s + File::SEPARATOR) }}"
puts "Product Strategy decisions crosswalked: #{PRODUCT_STRATEGY.glob('*.md').flat_map { |path| path.read.scan(/GAEP-STR-[A-Z0-9-]+-DEC-[A-Z0-9-]+/) }.uniq.length}"
puts "Core Open Decisions registered: #{core_open_decision_count}"
puts "Core Decision tiers: #{decision_tier_counts.sort.to_h}"
puts "Core Decision deferral policies: #{deferral_policy_tiers.sort.to_h}"
puts "Repository gaps registered: #{repository_gap_count}"
puts "Repository gap severities: #{repository_gap_severity_counts.sort.to_h}"
puts "Repository gap statuses: #{repository_gap_status_counts.sort.to_h}"
puts "paper scenario results: #{paper_scenario_result_count}"
puts "paper scenario outcomes: #{paper_scenario_outcomes.sort.to_h}"
puts "migration rehearsal cases: #{migration_rehearsal_case_count}"
puts "methodology references: #{methodology_reference_count}"
puts "methodology concerns: #{methodology_concern_count}"
puts "methodology mappings: #{methodology_mapping_count}"
puts "methodology deferred candidates: #{methodology_deferred_count}"
puts "methodology catalog digest: #{methodology_catalog_digest ? "sha256:#{methodology_catalog_digest}" : 'unavailable'}"
puts "GAEP-on-GAEP rehearsal steps: #{manual_rehearsal_step_count}"
puts "semantic rehearsal input files: #{semantic_input_paths.length}"
puts "semantic rehearsal input digest: sha256:#{semantic_input_digest}"
puts "Candidate Revision Set manifest: #{manifest ? manifest['designation'] : 'not-supplied'}"
puts "Candidate Revision Set members: #{manifest&.dig('membership', 'member_count') || 0}"
puts "stale declared-count findings: #{stale_declared_count_findings}"
puts "authority blocker classes: #{authority_blockers.length}"
puts "warnings: #{warnings.length}"
warnings.each { |warning| puts "WARN: #{warning}" }

if errors.empty? && gate_blockers.empty?
  puts "result: PASS"
  exit 0
end

unless errors.empty?
  puts "errors: #{errors.length}"
  errors.each { |error| puts "ERROR: #{error}" }
end
unless gate_blockers.empty?
  puts "gate blockers: #{gate_blockers.length}"
  gate_blockers.each { |blocker| puts "BLOCKER: #{blocker}" }
end

if errors.empty?
  puts "result: BLOCKED"
  exit 2
end

puts "result: FAIL"
exit 1
