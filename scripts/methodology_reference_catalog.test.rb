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

  def test_positive_fixture_is_valid_and_serialization_is_stable
    assert_empty MethodologyReferenceCatalog.validate(@catalog, raw_text: @raw)
    first = MethodologyReferenceCatalog.canonical_json(@catalog)
    second = MethodologyReferenceCatalog.canonical_json(JSON.parse(first))
    assert_equal first, second
  end

  def test_negative_duplicate_reference_identity
    hostile = clone_catalog
    hostile["references"][1]["referenceId"] = hostile["references"][0]["referenceId"]
    assert_error(hostile, "duplicate referenceId")
  end

  def test_negative_missing_and_non_https_official_source
    missing = clone_catalog
    missing["references"][0].delete("officialUri")
    assert_error(missing, "missing fields: officialUri")

    hostile = clone_catalog
    hostile["references"][0]["officialUri"] = "http://example.invalid/reference"
    assert_error(hostile, "must be an HTTPS official URI")
  end

  def test_negative_missing_version_and_impossible_dates
    missing = clone_catalog
    missing["references"][0]["versionOrEdition"] = ""
    assert_error(missing, "versionOrEdition must be a non-empty string")

    impossible = clone_catalog
    impossible["references"][0]["publicationDate"] = "2026-02-30"
    assert_error(impossible, "publicationDate is not a possible ISO date")

    chronology = clone_catalog
    chronology["references"][0]["publicationDate"] = "2026-08-08"
    chronology["references"][0]["checkedAt"] = "2026-08-07"
    assert_error(chronology, "checkedAt is earlier than publicationDate")
  end

  def test_negative_controlled_values
    {
      "referenceType" => "tool",
      "status" => "latest",
      "accessEvidence" => "probably-reviewed",
      "evidenceStatus" => "looks-good"
    }.each do |field, invalid|
      hostile = clone_catalog
      hostile["references"][0][field] = invalid
      assert_error(hostile, "#{field} is invalid")
    end
  end

  def test_negative_supersession_self_cycle_and_status_conflict
    self_supersession = clone_catalog
    reference = self_supersession["references"][0]
    reference["supersededBy"] = [reference["referenceId"]]
    assert_error(self_supersession, "cannot supersede itself")

    cycle = clone_catalog
    left, right = cycle["references"][0, 2]
    left["supersededBy"] = [right["referenceId"]]
    right["supersededBy"] = [left["referenceId"]]
    assert_error(cycle, "supersession cycle")

    incompatible = clone_catalog
    incompatible["references"][0]["status"] = "current"
    incompatible["references"][0]["underRevision"] = true
    assert_error(incompatible, "current status is incompatible")
  end

  def test_hostile_claims_and_unverified_evidence_fail_closed
    strong = clone_catalog
    strong["references"][0]["claimLanguage"] = "GAEP is ISO-compliant and production-ready."
    assert_error(strong, "claimLanguage is stronger than recorded evidence")

    unverified = clone_catalog
    unverified["references"][0]["evidenceStatus"] = "unverified"
    unverified["references"][0]["claimLanguage"] = "GAEP guarantees secure engineering."
    assert_error(unverified, "unverified source supports a strong claim")
  end

  def test_hostile_unknown_crosswalk_ids_and_type_confusion
    unknown = clone_catalog
    unknown["mappings"][0]["referenceIds"] = ["GAEP-XREF-999"]
    assert_error(unknown, "referenceIds contains unknown IDs")

    competitor = clone_catalog
    competitor["references"][0]["referenceType"] = "competitor-product"
    assert_error(competitor, "referenceType is invalid")

    tool = clone_catalog
    tool["references"][0]["canonicalName"] = "Figma"
    tool["references"][0]["referenceType"] = "methodology"
    assert_error(tool, "classifies a replaceable tool or provider as methodology")
  end

  def test_hostile_vendor_phase_universal_ddd_microservices_and_waterfall
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

  def test_negative_noncanonical_identity_lexical_and_serialization_order
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
