# frozen_string_literal: true

require "json"
require "minitest/autorun"
require_relative "lib/methodology_reference_catalog"

class MethodologyReferenceCatalogTest < Minitest::Test
  CATALOG_PATH = File.expand_path(
    "../docs/next/99_Registries_and_References/011_METHODOLOGY_REFERENCE_CATALOG.json",
    __dir__
  )

  def setup
    @raw = File.read(CATALOG_PATH)
    @catalog = JSON.parse(@raw)
  end

  def test_positive_fixture_is_semantically_valid_and_serialization_is_stable
    assert_empty MethodologyReferenceCatalog.validate(@catalog, raw_text: @raw)
    first = MethodologyReferenceCatalog.canonical_json(@catalog)
    second = MethodologyReferenceCatalog.canonical_json(JSON.parse(first))
    assert_equal first, second
  end

  def test_duplicate_assessed_reference_identity_fails
    hostile = clone_catalog
    hostile["references"][1]["referenceId"] = hostile["references"][0]["referenceId"]
    assert_error(hostile, "duplicate referenceId")
  end

  def test_reference_chronology_fails_closed
    hostile = clone_catalog
    hostile["references"][0]["access"]["date"] = "2020-01-01"
    assert_error(hostile, "access.date is earlier than publicationDate")

    hostile = clone_catalog
    hostile["references"][0]["nextReviewDate"] = "2020-01-01"
    assert_error(hostile, "nextReviewDate is earlier than freshnessCheckedAt")
  end

  def test_current_revision_status_conflict_fails
    hostile = clone_catalog
    reference = hostile["references"].find { |entry| entry["status"] == "current" }
    reference["underRevision"] = true
    assert_error(hostile, "current status is incompatible")
  end

  def test_supersession_self_cycle_and_status_conflicts_fail
    self_supersession = clone_catalog
    reference = self_supersession["references"][2]
    reference["status"] = "superseded"
    reference["supersedes"] = [reference["referenceId"]]
    reference["supersededBy"] = [reference["referenceId"]]
    assert_error(self_supersession, "cannot supersede itself")

    cycle = clone_catalog
    left, right = cycle["references"][2, 2]
    left["status"] = "superseded"
    right["status"] = "superseded"
    left["supersedes"] = [right["referenceId"]]
    left["supersededBy"] = [right["referenceId"]]
    right["supersedes"] = [left["referenceId"]]
    right["supersededBy"] = [left["referenceId"]]
    assert_error(cycle, "supersession cycle")

    no_successor = clone_catalog
    no_successor["references"][2]["status"] = "superseded"
    assert_error(no_successor, "requires a successor reference")
  end

  def test_overstrong_and_unverified_claims_fail_closed
    strong = clone_catalog
    strong["references"][0]["claimLanguage"] = "GAEP is ISO-compliant and production-ready."
    assert_error(strong, "claimLanguage is stronger than recorded evidence")

    unverified = clone_catalog
    unverified["references"][0]["evidenceStatus"] = "unverified"
    unverified["references"][0]["claimLanguage"] = "GAEP guarantees secure engineering."
    assert_error(unverified, "unverified source supports a strong claim")
  end

  def test_unknown_crosswalk_ids_and_concern_name_drift_fail
    unknown = clone_catalog
    unknown["mappings"][0]["referenceBindings"] = [
      { "referenceId" => "GAEP-XREF-999", "versionOrEdition" => "unknown" }
    ]
    assert_error(unknown, "referenceBindings contains unknown IDs")

    unknown_concern = clone_catalog
    unknown_concern["references"][0]["gaepConcernIds"] << "GAEP-MTH-CON-999"
    assert_error(unknown_concern, "gaepConcernIds contains unknown IDs")

    drift = clone_catalog
    drift["mappings"][0]["concern"] = "Different concern"
    assert_error(drift, "must equal the canonical concern name")
  end

  def test_mapping_reference_symmetry_and_bound_version_fail_closed
    missing_reference_side = clone_catalog
    mapping = missing_reference_side["mappings"].find { |entry| !entry["referenceBindings"].empty? }
    reference_id = mapping["referenceBindings"].first["referenceId"]
    missing_reference_side["references"].find { |entry| entry["referenceId"] == reference_id }["gaepConcernIds"].delete(mapping["concernId"])
    assert_error(missing_reference_side, "without reciprocal gaepConcernIds")

    missing_mapping_side = clone_catalog
    reference = missing_mapping_side["references"].find { |entry| !entry["gaepConcernIds"].empty? }
    concern_id = reference["gaepConcernIds"].first
    missing_mapping_side["mappings"].find { |entry| entry["concernId"] == concern_id }["referenceBindings"].reject! do |binding|
      binding["referenceId"] == reference["referenceId"]
    end
    assert_error(missing_mapping_side, "without reciprocal mapping binding")

    stale = clone_catalog
    stale["mappings"].find { |entry| !entry["referenceBindings"].empty? }["referenceBindings"][0]["versionOrEdition"] = "stale"
    assert_error(stale, "reference binding version is stale")
  end

  def test_tool_provider_vendor_phase_ddd_microservices_and_waterfall_fail
    tool = clone_catalog
    tool["references"][0]["canonicalName"] = "Figma"
    tool["references"][0]["referenceType"] = "methodology"
    assert_error(tool, "tool, provider, or competitor Product as methodology")

    vendor_phase = clone_catalog
    vendor_phase["mappings"][0]["concern"] = "Figma lifecycle phase"
    assert_error(vendor_phase, "names a lifecycle phase after a vendor tool")

    universal_ddd = clone_catalog
    universal_ddd["mappings"][0]["gaepAdaptation"] = "DDD is mandatory for every Initiative."
    assert_error(universal_ddd, "imposes universal DDD")

    microservices = clone_catalog
    microservices["mappings"][0]["gaepAdaptation"] = "DDD implies microservices."
    assert_error(microservices, "incorrectly implies DDD requires microservices")

    waterfall = clone_catalog
    waterfall["mappings"][0]["gaepAdaptation"] = "Freeze the entire Product before implementation."
    assert_error(waterfall, "fixed full-scope waterfall")
  end

  def test_noncanonical_identity_lexical_and_serialization_order_fails
    hostile = clone_catalog
    hostile["references"].reverse!
    hostile["references"][0]["limitations"].reverse!
    raw = "#{JSON.pretty_generate(hostile)}\n"
    errors = MethodologyReferenceCatalog.validate(hostile, raw_text: raw)
    assert_includes errors, "catalog serialization or collection ordering is not canonical"
  end

  private

  def clone_catalog
    JSON.parse(JSON.generate(@catalog))
  end

  def assert_error(catalog, fragment)
    errors = MethodologyReferenceCatalog.validate(catalog)
    assert errors.any? { |error| error.include?(fragment) }, "expected #{fragment.inspect} in #{errors.inspect}"
  end
end
