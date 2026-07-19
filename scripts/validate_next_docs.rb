#!/usr/bin/env ruby
# frozen_string_literal: true

require "pathname"
require "set"
require "yaml"

ROOT = Pathname.new(__dir__).join("..").expand_path
NEXT_DOCS = ROOT.join("docs", "next")
LEGACY_DOCS = ROOT.join("docs")
LEGACY_MIGRATION_MAP = NEXT_DOCS.join("08_Roadmap_and_Adoption", "004_LEGACY_MIGRATION_MAP.md")
OWNER_ROLE_REGISTRY_ID = "GAEP-REG-008"
PRODUCT_DECISION_CROSSWALK = NEXT_DOCS.join("06_GAEP_On_GAEP", "011_PRODUCT_DECISION_CROSSWALK.md")
PRODUCT_STRATEGY = NEXT_DOCS.join("00_GAEP_Product_Strategy")
CORE_OPEN_DECISION_REGISTER = NEXT_DOCS.join("99_Registries_and_References", "009_CORE_OPEN_DECISION_REGISTER.md")
CORE_SPECIFICATION = NEXT_DOCS.join("02_Core_Specification")
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

errors = []
warnings = []
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
errors << "No candidate Markdown files found under #{NEXT_DOCS}" if files.empty?

files.each do |path|
  relative = path.relative_path_from(ROOT).to_s
  text = path.read

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


requirement_references.each do |requirement_id, locations|
  next if requirement_definitions.key?(requirement_id)

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
if CORE_OPEN_DECISION_REGISTER.exist?
  source_open_decisions = Set.new
  CORE_SPECIFICATION.glob("*.md").each do |path|
    path.read.scan(/GAEP-[A-Z0-9-]+-OD-\d{3}/) { |id| source_open_decisions << id }
  end
  registered_open_decisions = CORE_OPEN_DECISION_REGISTER.read.scan(/^\|\s*(GAEP-[A-Z0-9-]+-OD-\d{3})\s*\|/).flatten
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
  core_open_decision_count = source_open_decisions.length
else
  errors << "missing Core Open Decision Register #{CORE_OPEN_DECISION_REGISTER.relative_path_from(ROOT)}"
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

%w[README.md CONTRIBUTING.md LICENSE_STATUS.md SECURITY.md CHANGELOG.md].each do |relative|
  path = ROOT.join(relative)
  next unless path.exist?

  path.read.scan(/\[[^\]]*\]\(([^)]+)\)/).flatten.each do |target|
    clean = target.split("#", 2).first
    next if clean.nil? || clean.empty?
    next if clean.match?(%r{\A(?:https?|mailto):})
    next if clean.start_with?("#")

    resolved = clean.start_with?("/") ? Pathname.new(clean) : path.dirname.join(clean).cleanpath
    errors << "#{relative}: broken local link #{target}" unless resolved.exist?
  end
end

puts "GAEP Next documentation validation"
puts "documents: #{files.length}"
puts "document ids: #{documents.length}"
puts "requirement definitions: #{requirement_definitions.length}"
puts "legacy documents mapped: #{LEGACY_DOCS.glob('**/*.md').count { |path| !path.to_s.start_with?(NEXT_DOCS.to_s + File::SEPARATOR) }}"
puts "Product Strategy decisions crosswalked: #{PRODUCT_STRATEGY.glob('*.md').flat_map { |path| path.read.scan(/GAEP-STR-[A-Z0-9-]+-DEC-[A-Z0-9-]+/) }.uniq.length}"
puts "Core Open Decisions registered: #{core_open_decision_count}"
puts "warnings: #{warnings.length}"
warnings.each { |warning| puts "WARN: #{warning}" }

if errors.empty?
  puts "result: PASS"
  exit 0
end

puts "errors: #{errors.length}"
errors.each { |error| puts "ERROR: #{error}" }
puts "result: FAIL"
exit 1
