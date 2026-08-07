# frozen_string_literal: true

require "json"
require "minitest/autorun"
require_relative "lib/methodology_reference_catalog"

class MethodologyReferenceCatalogIntegrityTest < Minitest::Test
  CATALOG_PATH = File.expand_path(
    "../docs/next/99_Registries_and_References/011_METHODOLOGY_REFERENCE_CATALOG.json",
    __dir__
  )

  def setup
    @catalog = JSON.parse(File.read(CATALOG_PATH))
  end

  def test_duplicate_assessed_reference_id
    hostile = clone_catalog
    hostile["references"][1]["referenceId"] = hostile["references"][0]["referenceId"]
    assert_error(hostile, "duplicate referenceId")
  end

  def test_duplicate_deferred_reference_id
    hostile = clone_catalog
    hostile["deferredCandidates"][1]["referenceId"] = hostile["deferredCandidates"][0]["referenceId"]
    assert_error(hostile, "duplicate deferred referenceId")
  end

  def test_assessed_and_deferred_reference_id_overlap
    hostile = clone_catalog
    hostile["deferredCandidates"][0]["referenceId"] = hostile["references"][0]["referenceId"]
    assert_error(hostile, "assessed and deferred reference IDs overlap")
  end

  def test_unknown_reference_gaep_concern_id
    hostile = clone_catalog
    hostile["references"][0]["gaepConcernIds"] << "GAEP-MTH-CON-999"
    assert_error(hostile, "gaepConcernIds contains unknown IDs")
  end

  def test_unknown_mapping_reference_id
    hostile = clone_catalog
    hostile["mappings"][0]["referenceBindings"] = [
      { "referenceId" => "GAEP-XREF-999", "versionOrEdition" => "unknown" }
    ]
    assert_error(hostile, "referenceBindings contains unknown IDs")
  end

  def test_unknown_supersedes_reference_id
    hostile = clone_catalog
    hostile["references"][0]["supersedes"] = ["GAEP-XREF-999"]
    assert_error(hostile, "supersedes contains unknown reference ID")
  end

  def test_unknown_superseded_by_reference_id
    hostile = clone_catalog
    hostile["references"][2]["status"] = "superseded"
    hostile["references"][2]["supersededBy"] = ["GAEP-XREF-999"]
    assert_error(hostile, "supersededBy contains unknown reference ID")
  end

  def test_self_supersession
    hostile = clone_catalog
    reference = hostile["references"][2]
    reference["status"] = "superseded"
    reference["supersedes"] = [reference["referenceId"]]
    reference["supersededBy"] = [reference["referenceId"]]
    assert_error(hostile, "cannot supersede itself")
  end

  def test_one_sided_supersession
    hostile = clone_catalog
    successor, predecessor = hostile["references"][2, 2]
    successor["supersedes"] = [predecessor["referenceId"]]
    predecessor["status"] = "superseded"
    assert_error(hostile, "is not reciprocal")
  end

  def test_direct_supersession_cycle
    hostile = clone_catalog
    left, right = hostile["references"][2, 2]
    left["status"] = "superseded"
    right["status"] = "superseded"
    left["supersedes"] = [right["referenceId"]]
    left["supersededBy"] = [right["referenceId"]]
    right["supersedes"] = [left["referenceId"]]
    right["supersededBy"] = [left["referenceId"]]
    assert_error(hostile, "supersession cycle")
  end

  def test_indirect_supersession_cycle
    hostile = clone_catalog
    first, second, third = hostile["references"][2, 3]
    [first, second, third].each { |reference| reference["status"] = "superseded" }
    first["supersedes"] = [second["referenceId"]]
    second["supersededBy"] = [first["referenceId"]]
    second["supersedes"] = [third["referenceId"]]
    third["supersededBy"] = [second["referenceId"]]
    third["supersedes"] = [first["referenceId"]]
    first["supersededBy"] = [third["referenceId"]]
    assert_error(hostile, "supersession cycle")
  end

  def test_superseded_reference_without_successor
    hostile = clone_catalog
    hostile["references"][2]["status"] = "superseded"
    assert_error(hostile, "requires a successor reference")
  end

  def test_current_revision_conflict
    hostile = clone_catalog
    reference = hostile["references"].find { |entry| entry["status"] == "current" }
    reference["underRevision"] = true
    assert_error(hostile, "current status is incompatible")
  end

  def test_version_certainty_conflict
    hostile = clone_catalog
    hostile["references"][2]["status"] = "unverifiable"
    hostile["references"][2]["versionCertainty"] = "exact"
    assert_error(hostile, "unverifiable status requires unverifiable version certainty")
  end

  def test_unknown_concern_mapping
    hostile = clone_catalog
    hostile["mappings"][0]["concernId"] = "GAEP-MTH-CON-999"
    assert_error(hostile, "mappings reference unknown concerns")
  end

  def test_duplicate_concern_mapping
    hostile = clone_catalog
    hostile["mappings"][1]["concernId"] = hostile["mappings"][0]["concernId"]
    assert_error(hostile, "duplicate mapping concernId")
  end

  def test_missing_concern_mapping
    hostile = clone_catalog
    hostile["mappings"].delete_at(0)
    assert_error(hostile, "concerns without mappings")
  end

  def test_mapping_concern_name_mismatch
    hostile = clone_catalog
    hostile["mappings"][0]["concern"] = "Wrong concern name"
    assert_error(hostile, "must equal the canonical concern name")
  end

  def test_mapping_reference_missing_reciprocal_gaep_concern_id
    hostile = clone_catalog
    mapping = first_external_mapping(hostile)
    reference_id = mapping["referenceBindings"][0]["referenceId"]
    reference = hostile["references"].find { |entry| entry["referenceId"] == reference_id }
    reference["gaepConcernIds"].delete(mapping["concernId"])
    assert_error(hostile, "without reciprocal gaepConcernIds")
  end

  def test_reference_gaep_concern_id_missing_reciprocal_mapping_reference
    hostile = clone_catalog
    reference = hostile["references"].find { |entry| !entry["gaepConcernIds"].empty? }
    concern_id = reference["gaepConcernIds"].first
    mapping = hostile["mappings"].find { |entry| entry["concernId"] == concern_id }
    mapping["referenceBindings"].reject! { |binding| binding["referenceId"] == reference["referenceId"] }
    assert_error(hostile, "without reciprocal mapping binding")
  end

  def test_gaep_native_mapping_with_external_ownership
    hostile = clone_catalog
    mapping = hostile["mappings"].find { |entry| entry["gaepNative"] }
    reference = hostile["references"][0]
    mapping["referenceBindings"] = [
      { "referenceId" => reference["referenceId"], "versionOrEdition" => reference["versionOrEdition"] }
    ]
    assert_error(hostile, "GAEP-native mapping cannot attribute ownership")
  end

  def test_non_native_mapping_without_external_reference
    hostile = clone_catalog
    mapping = first_external_mapping(hostile)
    mapping["referenceBindings"] = []
    assert_error(hostile, "non-native mapping requires at least one external reference")
  end

  def test_missing_assessor_or_unassigned_assessor_role
    hostile = clone_catalog
    hostile["mappings"][0]["assessment"]["assessor"] = {
      "kind" => "unassigned-role",
      "role" => ""
    }
    assert_error(hostile, "unassigned assessor role is missing")
  end

  def test_missing_accountable_mapping_owner
    hostile = clone_catalog
    hostile["mappings"][0]["assessment"]["ownerRole"] = ""
    assert_error(hostile, "accountable owner role is missing")
  end

  def test_stale_reference_binding_version
    hostile = clone_catalog
    first_external_mapping(hostile)["referenceBindings"][0]["versionOrEdition"] = "stale version"
    assert_error(hostile, "reference binding version is stale")
  end

  def test_wrong_gaep_target_version
    hostile = clone_catalog
    hostile["mappings"][0]["gaepTarget"]["artifactVersion"] = "0.2.0"
    assert_error(hostile, "GAEP target artifact identity or version is stale")
  end

  def test_invalid_mapping_assessment_review_chronology
    hostile = clone_catalog
    hostile["mappings"][0]["assessment"]["nextReviewDate"] = "2020-01-01"
    assert_error(hostile, "next review date is earlier than assessment date")
  end

  def test_overstrong_claim
    hostile = clone_catalog
    hostile["references"][0]["claimLanguage"] = "GAEP is fully compliant and production-ready."
    assert_error(hostile, "claimLanguage is stronger than recorded evidence")
  end

  def test_unverified_strong_claim
    hostile = clone_catalog
    hostile["references"][0]["evidenceStatus"] = "unverified"
    hostile["references"][0]["claimLanguage"] = "GAEP guarantees secure outcomes."
    assert_error(hostile, "unverified source supports a strong claim")
  end

  def test_tool_or_provider_classified_as_methodology
    hostile = clone_catalog
    hostile["references"][0]["canonicalName"] = "Figma"
    hostile["references"][0]["referenceType"] = "methodology"
    assert_error(hostile, "tool, provider, or competitor Product as methodology")
  end

  def test_competitor_product_classified_as_methodology
    hostile = clone_catalog
    hostile["references"][0]["canonicalName"] = "Competitor Product"
    hostile["references"][0]["referenceType"] = "methodology"
    assert_error(hostile, "tool, provider, or competitor Product as methodology")
  end

  def test_vendor_named_lifecycle_phase
    hostile = clone_catalog
    hostile["mappings"][0]["concern"] = "Figma lifecycle phase"
    assert_error(hostile, "names a lifecycle phase after a vendor tool")
  end

  def test_universal_ddd_requirement
    hostile = clone_catalog
    hostile["mappings"][0]["gaepAdaptation"] = "DDD is mandatory for every Initiative."
    assert_error(hostile, "imposes universal DDD")
  end

  def test_ddd_implies_microservices
    hostile = clone_catalog
    hostile["mappings"][0]["gaepAdaptation"] = "DDD requires microservices."
    assert_error(hostile, "incorrectly implies DDD requires microservices")
  end

  def test_frozen_full_scope_architecture
    hostile = clone_catalog
    hostile["mappings"][0]["gaepAdaptation"] = "Freeze the full system before implementation."
    assert_error(hostile, "fixed full-scope waterfall")
  end

  def test_noncanonical_ordering
    hostile = clone_catalog
    hostile["mappings"].reverse!
    raw = "#{JSON.pretty_generate(hostile)}\n"
    assert_error(hostile, "catalog serialization or collection ordering is not canonical", raw_text: raw)
  end

  private

  def clone_catalog
    JSON.parse(JSON.generate(@catalog))
  end

  def first_external_mapping(catalog)
    catalog["mappings"].find { |entry| !entry["gaepNative"] }
  end

  def assert_error(catalog, fragment, raw_text: nil)
    errors = MethodologyReferenceCatalog.validate(catalog, raw_text: raw_text)
    assert errors.any? { |error| error.include?(fragment) }, "expected #{fragment.inspect} in #{errors.inspect}"
  end
end
