#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "json"
require "pathname"
require_relative "lib/methodology_reference_catalog"

root = Pathname.new(__dir__).join("..").expand_path
catalog_path = root.join("docs", "next", "99_Registries_and_References", "011_METHODOLOGY_REFERENCE_CATALOG.json")
crosswalk_path = root.join("docs", "next", "99_Registries_and_References", "002_EXTERNAL_STANDARDS_CROSSWALK.md")
mode = ARGV.fetch(0, "--check")
unless %w[--check --write].include?(mode) && ARGV.length == 1
  warn "usage: ruby scripts/render_methodology_crosswalk.rb [--check|--write]"
  exit 64
end

catalog = JSON.parse(catalog_path.read)
catalog_errors = MethodologyReferenceCatalog.validate(catalog, raw_text: catalog_path.read)
unless catalog_errors.empty?
  warn catalog_errors.join("\n")
  exit 1
end

text = crosswalk_path.read
replacements = {
  ["<!-- BEGIN GENERATED CONCERN CROSSWALK -->", "<!-- END GENERATED CONCERN CROSSWALK -->"] => MethodologyReferenceCatalog.mapping_projection(catalog),
  ["<!-- BEGIN GENERATED REFERENCE INVENTORY -->", "<!-- END GENERATED REFERENCE INVENTORY -->"] => MethodologyReferenceCatalog.reference_projection(catalog)
}
rendered = text.dup
replacements.each do |(start_marker, end_marker), projection|
  pattern = /#{Regexp.escape(start_marker)}\n.*?\n#{Regexp.escape(end_marker)}/m
  unless rendered.match?(pattern)
    warn "crosswalk is missing generated projection markers: #{start_marker}"
    exit 1
  end
  rendered.sub!(pattern, "#{start_marker}\n#{projection}\n#{end_marker}")
end

digest = Digest::SHA256.hexdigest(catalog_path.read)
rendered.gsub!(/Catalog SHA-256: `[0-9a-f]{64}`/, "Catalog SHA-256: `#{digest}`")
rendered.gsub!(/Catalog version: `[^`]+`/, "Catalog version: `#{catalog.fetch('version')}`")
rendered.gsub!(/Catalog assessed references: `\d+`/, "Catalog assessed references: `#{catalog.fetch('references').length}`")
rendered.gsub!(/Catalog concern mappings: `\d+`/, "Catalog concern mappings: `#{catalog.fetch('mappings').length}`")
rendered.gsub!(/Catalog deferred candidates: `\d+`/, "Catalog deferred candidates: `#{catalog.fetch('deferredCandidates').length}`")

if mode == "--write"
  crosswalk_path.write(rendered)
  puts "updated #{crosswalk_path.relative_path_from(root)}"
elsif rendered == text
  puts "methodology crosswalk projection: PASS"
else
  warn "methodology crosswalk projection is stale; run ruby scripts/render_methodology_crosswalk.rb --write"
  exit 1
end
