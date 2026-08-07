# frozen_string_literal: true

require "digest"
require "json"
require "minitest/autorun"
require "open3"
require_relative "lib/methodology_reference_catalog"

class MethodologyReferenceCatalogParityTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  CATALOG_PATH = File.join(ROOT, "docs/next/99_Registries_and_References/011_METHODOLOGY_REFERENCE_CATALOG.json")
  SCHEMA_PATH = File.join(ROOT, "docs/next/99_Registries_and_References/011_METHODOLOGY_REFERENCE_CATALOG.schema.json")
  CROSSWALK_PATH = File.join(ROOT, "docs/next/99_Registries_and_References/002_EXTERNAL_STANDARDS_CROSSWALK.md")

  def setup
    @catalog_raw = File.read(CATALOG_PATH)
    @catalog = JSON.parse(@catalog_raw)
    @schema = JSON.parse(File.read(SCHEMA_PATH))
  end

  def test_schema_required_fields_equal_serializer_field_sets
    assert_equal MethodologyReferenceCatalog::TOP_LEVEL_FIELDS, @schema.fetch("required")
    assert_equal MethodologyReferenceCatalog::APPROVAL_FIELDS, required("approval")
    assert_equal MethodologyReferenceCatalog::CONCERN_FIELDS, required("concern")
    assert_equal MethodologyReferenceCatalog::REFERENCE_FIELDS, required("reference")
    assert_equal MethodologyReferenceCatalog::ACCESS_FIELDS, required("access")
    assert_equal MethodologyReferenceCatalog::CONTENT_REVIEW_FIELDS, required("contentReview")
    assert_equal MethodologyReferenceCatalog::MAPPING_FIELDS, required("mapping")
    assert_equal MethodologyReferenceCatalog::REFERENCE_BINDING_FIELDS, required("referenceBinding")
    assert_equal MethodologyReferenceCatalog::ASSESSMENT_FIELDS, required("mappingAssessment")
    assert_equal MethodologyReferenceCatalog::GAEP_TARGET_FIELDS, required("gaepTarget")
    assert_equal MethodologyReferenceCatalog::DEFERRED_FIELDS, required("deferredCandidate")
  end

  def test_schema_enums_equal_semantic_registered_values
    assert_equal MethodologyReferenceCatalog::REFERENCE_TYPES, property("reference", "referenceType").fetch("enum")
    assert_equal MethodologyReferenceCatalog::REFERENCE_STATUSES, property("reference", "status").fetch("enum")
    assert_equal MethodologyReferenceCatalog::VERSION_CERTAINTIES, property("reference", "versionCertainty").fetch("enum")
    assert_equal MethodologyReferenceCatalog::ACCESS_STATUSES, property("access", "status").fetch("enum")
    assert_equal MethodologyReferenceCatalog::ACCESS_EVIDENCE, property("access", "evidence").fetch("enum")
    assert_equal MethodologyReferenceCatalog::CONTENT_REVIEW_STATUSES, property("contentReview", "status").fetch("enum")
    assert_equal MethodologyReferenceCatalog::CONTENT_REVIEW_DEPTHS, property("contentReview", "depth").fetch("enum")
    assert_equal MethodologyReferenceCatalog::RIGHTS_STATUSES, property("reference", "rightsStatus").fetch("enum")
    assert_equal MethodologyReferenceCatalog::EVIDENCE_STATUSES, property("reference", "evidenceStatus").fetch("enum")
    assert_equal MethodologyReferenceCatalog::RELATIONSHIP_STATUSES, property("mapping", "relationshipStatus").fetch("enum")
    assert_equal MethodologyReferenceCatalog::DEFERRED_STATUSES, property("deferredCandidate", "status").fetch("enum")
  end

  def test_schema_catalog_and_target_identities_and_versions_match
    assert_equal MethodologyReferenceCatalog::SCHEMA_ID, @schema.fetch("$id")
    assert_equal MethodologyReferenceCatalog::SCHEMA_ID, @catalog.fetch("schemaId")
    assert_equal MethodologyReferenceCatalog::SCHEMA_VERSION, @catalog.fetch("schemaVersion")
    assert_equal MethodologyReferenceCatalog::CATALOG_ID, @catalog.fetch("catalogId")
    assert_equal MethodologyReferenceCatalog::CATALOG_VERSION, @catalog.fetch("version")
    @catalog.fetch("mappings").each do |mapping|
      target = mapping.fetch("gaepTarget")
      assert_equal MethodologyReferenceCatalog::TARGET_ARTIFACT_ID, target.fetch("artifactId")
      assert_equal MethodologyReferenceCatalog::TARGET_ARTIFACT_VERSION, target.fetch("artifactVersion")
      assert_equal MethodologyReferenceCatalog::CATALOG_ID, target.fetch("catalogId")
      assert_equal MethodologyReferenceCatalog::CATALOG_VERSION, target.fetch("catalogVersion")
    end
  end

  def test_renderer_projects_exact_catalog_identity_version_digest_and_sections
    stdout, stderr, status = Open3.capture3("ruby", "scripts/render_methodology_crosswalk.rb", "--check", chdir: ROOT)
    assert status.success?, "#{stdout}\n#{stderr}"

    crosswalk = File.read(CROSSWALK_PATH)
    digest = Digest::SHA256.hexdigest(@catalog_raw)
    assert_includes crosswalk, "Catalog ID: `#{@catalog.fetch('catalogId')}`"
    assert_includes crosswalk, "Schema ID: `#{@catalog.fetch('schemaId')}`"
    assert_includes crosswalk, "Schema version: `#{@catalog.fetch('schemaVersion')}`"
    assert_includes crosswalk, "Catalog version: `#{@catalog.fetch('version')}`"
    assert_includes crosswalk, "Catalog SHA-256: `#{digest}`"
    assert_equal MethodologyReferenceCatalog.mapping_projection(@catalog), generated(crosswalk, "CONCERN CROSSWALK")
    assert_equal MethodologyReferenceCatalog.assessment_projection(@catalog), generated(crosswalk, "MAPPING GOVERNANCE")
    assert_equal MethodologyReferenceCatalog.reference_projection(@catalog), generated(crosswalk, "REFERENCE INVENTORY")
  end

  private

  def required(definition)
    @schema.fetch("$defs").fetch(definition).fetch("required")
  end

  def property(definition, name)
    @schema.fetch("$defs").fetch(definition).fetch("properties").fetch(name)
  end

  def generated(text, label)
    text.match(/<!-- BEGIN GENERATED #{Regexp.escape(label)} -->\n(.*?)\n<!-- END GENERATED #{Regexp.escape(label)} -->/m)[1]
  end
end
