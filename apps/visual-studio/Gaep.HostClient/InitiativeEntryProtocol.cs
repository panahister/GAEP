using System.Text.Json;
using System.Text.RegularExpressions;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string InitiativeClassificationBoundary =
        "classification-guides-profile-selection-and-does-not-grant-approval-or-action-authority";
    private const string InitiativeDecisionBoundary =
        "applicability-decision-does-not-grant-approval-readiness-or-action-authority";
    private const string InitiativeMatrixBoundary =
        "applicability-matrix-does-not-grant-approval-readiness-or-action-authority";
    private const string InitiativeAssessmentBoundary =
        "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority";

    private static readonly HashSet<string> InitiativeTypes = new(StringComparer.Ordinal)
    {
        "product", "platform", "product-increment", "feature", "epic", "backlog-item", "service", "module",
        "client-application", "mobile-application", "api", "integration", "migration", "modernization",
        "refactoring", "technical-debt-remediation", "security-remediation", "infrastructure", "devops",
        "observability", "library", "sdk", "cli", "worker", "event-processor", "defect-fix", "experiment",
        "research", "data-capability", "ai-capability",
    };

    private static readonly HashSet<string> InitiativeApplicabilityStatuses = new(StringComparer.Ordinal)
    {
        "required", "recommended", "optional", "not-applicable", "deferred", "conditionally-required",
        "already-satisfied", "reused", "blocked", "awaiting-human-decision",
    };

    private static readonly HashSet<string> InitiativeSubjectTypes = new(StringComparer.Ordinal)
    {
        "phase", "activity", "artifact", "capability", "test-method", "test-level", "approval",
        "evidence-obligation",
    };

    private static readonly HashSet<string> InitiativeSourceKinds = new(StringComparer.Ordinal)
    {
        "rule", "policy", "evidence", "requirement", "dependency", "human-decision",
    };

    private static readonly InitiativeApplicabilitySubject[] CanonicalInitiativeApplicabilitySubjects =
    [
        new("phase", "intake", "Initiative intake"),
        new("phase", "initiative-classification", "Initiative classification"),
        new("phase", "existing-system-assessment", "Existing-system and lifecycle-state assessment"),
        new("phase", "scope-criticality-assessment", "Scope and criticality assessment"),
        new("phase", "applicability-assessment", "Applicability assessment"),
        new("phase", "architecture-assurance-resolution", "Architecture and assurance resolution"),
        new("phase", "implementation-verification", "Implementation and verification"),
        new("phase", "release-operation-learning", "Release, operation, and learning"),
        new("activity", "product-discovery", "Product discovery"),
        new("activity", "business-architecture", "Business architecture"),
        new("activity", "experience-design", "Experience and interaction design"),
        new("activity", "existing-system-discovery", "Existing-system discovery"),
        new("activity", "human-ai-challenge", "Human-AI challenge"),
        new("activity", "threat-modeling", "Threat modeling"),
        new("activity", "identity-authorization-analysis", "Identity and authorization analysis"),
        new("activity", "technology-selection", "Technology selection"),
        new("activity", "change-impact-analysis", "Change and impact analysis"),
        new("artifact", "initiative-profile", "Initiative Profile"),
        new("artifact", "applicability-matrix", "Applicability Matrix"),
        new("artifact", "source-baseline", "Source baseline"),
        new("artifact", "requirements-acceptance", "Requirements and acceptance criteria"),
        new("artifact", "architecture-assets", "Architecture Assets"),
        new("artifact", "technology-profile", "Technology Profile"),
        new("artifact", "assurance-strategy", "Assurance Strategy and Profile"),
        new("artifact", "release-evidence", "Release evidence package"),
        new("capability", "design-reference-integration", "Design-reference integration"),
        new("capability", "governed-agent-execution", "Governed agent execution"),
        new("capability", "managed-staging", "Managed staged changes"),
        new("capability", "provider-model-handoff", "Provider and model handoff"),
        new("test-method", "unit-testing", "Unit testing"),
        new("test-method", "integration-testing", "Integration testing"),
        new("test-method", "consumer-contract-testing", "Consumer contract testing"),
        new("test-method", "security-testing", "Security testing"),
        new("test-method", "usability-accessibility-testing", "Usability and accessibility testing"),
        new("test-level", "component", "Component test level"),
        new("test-level", "service", "Service test level"),
        new("test-level", "system", "System test level"),
        new("test-level", "acceptance", "Acceptance test level"),
        new("approval", "initiative-entry", "Initiative entry approval"),
        new("approval", "architecture", "Architecture approval"),
        new("approval", "security", "Security approval"),
        new("approval", "implementation", "Implementation approval"),
        new("approval", "release", "Release approval"),
        new("evidence-obligation", "classification", "Classification evidence"),
        new("evidence-obligation", "applicability", "Applicability evidence"),
        new("evidence-obligation", "traceability", "Traceability evidence"),
        new("evidence-obligation", "test-results", "Test result evidence"),
        new("evidence-obligation", "approval", "Approval evidence"),
        new("evidence-obligation", "rollback-operability", "Rollback and operability evidence"),
    ];

    internal static IReadOnlyDictionary<string, object?> SerializeInitiativeClassificationInput(
        InitiativeClassificationInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        var value = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["primaryType"] = input.PrimaryType,
            ["secondaryTypes"] = input.SecondaryTypes,
            ["systemState"] = input.SystemState,
            ["changePosture"] = input.ChangePosture,
            ["motivations"] = input.Motivations,
            ["characteristics"] = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["userInterface"] = input.Characteristics.UserInterface,
                ["data"] = input.Characteristics.Data,
                ["integration"] = input.Characteristics.Integration,
                ["interactionModes"] = input.Characteristics.InteractionModes,
                ["exposure"] = input.Characteristics.Exposure,
            },
            ["regulated"] = input.Regulated,
            ["policyDomains"] = input.PolicyDomains,
            ["sensitivities"] = input.Sensitivities,
            ["expectedLifetime"] = input.ExpectedLifetime,
            ["maintenanceHorizon"] = input.MaintenanceHorizon,
            ["risk"] = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["blastRadius"] = input.Risk.BlastRadius,
                ["reversibility"] = input.Risk.Reversibility,
                ["urgency"] = input.Risk.Urgency,
                ["costOfFailure"] = input.Risk.CostOfFailure,
            },
            ["dependencies"] = input.Dependencies,
            ["affectedAssets"] = input.AffectedAssets,
            ["owner"] = input.Owner,
            ["accountableAuthority"] = input.AccountableAuthority,
            ["confidence"] = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["level"] = input.Confidence.Level,
                ["basis"] = input.Confidence.Basis,
            },
            ["evidence"] = input.Evidence.Select(SerializeInitiativeSource).ToArray(),
            ["unresolvedQuestions"] = input.UnresolvedQuestions,
            ["rationale"] = input.Rationale,
        };
        try
        {
            ValidateInitiativeClassificationInput(JsonSerializer.SerializeToElement(value, StrictJson));
        }
        catch (EngineHostException)
        {
            throw new ArgumentException(
                "Initiative classification must contain only strict portable, non-secret, internally consistent values.",
                nameof(input));
        }
        return value;
    }

    internal static IReadOnlyDictionary<string, object?> SerializeInitiativeApplicabilityInput(
        InitiativeApplicabilityMatrixInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        var value = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["decisions"] = input.Decisions.Select(decision =>
            {
                var approval = new Dictionary<string, object?>(StringComparer.Ordinal)
                {
                    ["state"] = decision.Approval.State,
                    ["conditions"] = decision.Approval.Conditions,
                };
                if (decision.Approval.DecidedBy is not null)
                {
                    approval["decidedBy"] = new Dictionary<string, object?>(StringComparer.Ordinal)
                    {
                        ["kind"] = "human",
                        ["id"] = decision.Approval.DecidedBy,
                    };
                }
                if (decision.Approval.DecidedAt.HasValue) approval["decidedAt"] = decision.Approval.DecidedAt.Value;
                var serialized = new Dictionary<string, object?>(StringComparer.Ordinal)
                {
                    ["subject"] = SerializeInitiativeSubject(decision.Subject),
                    ["status"] = decision.Status,
                    ["rationale"] = decision.Rationale,
                    ["sources"] = decision.Sources.Select(SerializeInitiativeSource).ToArray(),
                    ["owner"] = decision.Owner,
                    ["dependencies"] = decision.Dependencies,
                    ["conditions"] = decision.Conditions,
                    ["reviewTriggers"] = decision.ReviewTriggers,
                    ["approval"] = approval,
                    ["relatedRecords"] = decision.RelatedRecords.Select(record =>
                        (IReadOnlyDictionary<string, object?>)new Dictionary<string, object?>(StringComparer.Ordinal)
                        {
                            ["recordType"] = record.RecordType,
                            ["recordId"] = record.RecordId,
                            ["revision"] = record.Revision,
                            ["digest"] = record.Digest,
                        }).ToArray(),
                    ["relatedImplementationUnits"] = decision.RelatedImplementationUnits,
                };
                if (decision.AccountableApprover is not null)
                {
                    serialized["accountableApprover"] = decision.AccountableApprover;
                }
                return (IReadOnlyDictionary<string, object?>)serialized;
            }).ToArray(),
            ["unresolvedSubjects"] = input.UnresolvedSubjects.Select(unresolved =>
                (IReadOnlyDictionary<string, object?>)new Dictionary<string, object?>(StringComparer.Ordinal)
                {
                    ["subject"] = SerializeInitiativeSubject(unresolved.Subject),
                    ["reason"] = unresolved.Reason,
                    ["owner"] = unresolved.Owner,
                }).ToArray(),
        };
        if (input.SubjectCatalog is not null)
        {
            value["subjectCatalog"] = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["catalogVersion"] = input.SubjectCatalog.CatalogVersion,
                ["digest"] = input.SubjectCatalog.Digest,
                ["subjectCount"] = input.SubjectCatalog.SubjectCount,
            };
        }
        try
        {
            ValidateInitiativeApplicabilityInput(JsonSerializer.SerializeToElement(value, StrictJson));
        }
        catch (EngineHostException)
        {
            throw new ArgumentException(
                "Initiative applicability must contain only explicit portable, non-secret, internally consistent decisions.",
                nameof(input));
        }
        return value;
    }

    internal static InitiativeApplicabilityMatrixInput CompleteInitiativeApplicabilityCoverage(
        InitiativeApplicabilityMatrixInput input,
        string unresolvedOwner)
    {
        SerializeInitiativeApplicabilityInput(input);
        var canonical = CanonicalInitiativeApplicabilitySubjects.ToDictionary(
            subject => $"{subject.Type}:{subject.Key}",
            StringComparer.Ordinal);
        var represented = new HashSet<string>(StringComparer.Ordinal);
        foreach (var subject in input.Decisions.Select(decision => decision.Subject)
                     .Concat(input.UnresolvedSubjects.Select(unresolved => unresolved.Subject)))
        {
            var key = $"{subject.Type}:{subject.Key}";
            if (!canonical.TryGetValue(key, out var expected) || expected != subject)
            {
                throw new ArgumentException(
                    $"Applicability subject {key} does not match the canonical catalog.",
                    nameof(input));
            }
            represented.Add(key);
        }
        var completed = input with
        {
            UnresolvedSubjects =
            [
                .. input.UnresolvedSubjects,
                .. CanonicalInitiativeApplicabilitySubjects
                    .Where(subject => !represented.Contains($"{subject.Type}:{subject.Key}"))
                    .Select(subject => new InitiativeUnresolvedSubject(
                        subject,
                        "No explicit applicability decision was recorded in this review; accountable resolution remains required.",
                        unresolvedOwner)),
            ],
        };
        SerializeInitiativeApplicabilityInput(completed);
        return completed;
    }

    internal static InitiativeEntryRecord ParseInitiativeResponse(
        JsonElement envelope,
        Guid expectedInitiativeId,
        long? expectedRevision = null,
        string? expectedActorId = null,
        IReadOnlyDictionary<string, object?>? expectedClassificationInput = null,
        IReadOnlyDictionary<string, object?>? expectedApplicabilityInput = null)
    {
        var initiative = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                initiative,
                [
                    "schemaVersion", "id", "kind", "revision", "productId", "title", "outcome", "scope",
                    "exclusions", "state", "createdAt", "updatedAt",
                ],
                ["classification", "applicability"]) ||
            ParseBoundedNonNegativeInt(initiative, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(initiative, "kind", "initiative") != "initiative")
        {
            throw InvalidResponse();
        }
        var id = ParseRequiredGuid(initiative, "id");
        var revision = ParsePositiveLong(initiative, "revision");
        var productId = ParseRequiredGuid(initiative, "productId");
        if (id != expectedInitiativeId) throw InvalidResponse();
        ParseInitiativeTextProperty(initiative, "title", 2, 240);
        ParseInitiativeTextProperty(initiative, "outcome", 4, 5_000);
        ValidateInitiativeTextArray(initiative.GetProperty("scope"), 1, 256);
        ValidateInitiativeTextArray(initiative.GetProperty("exclusions"), 0, 256);
        var state = ParseRequiredEnum(initiative, "state", "proposed", "active", "blocked", "completed", "cancelled");
        var createdAt = ParseRequiredTimestamp(initiative, "createdAt");
        var updatedAt = ParseRequiredTimestamp(initiative, "updatedAt");
        if (updatedAt < createdAt) throw InvalidResponse();

        var classification = initiative.TryGetProperty("classification", out var classificationElement)
            ? ParseInitiativeClassification(classificationElement)
            : null;
        var applicability = initiative.TryGetProperty("applicability", out var applicabilityElement)
            ? ParseInitiativeApplicability(applicabilityElement, id, productId)
            : null;
        if (expectedRevision.HasValue && revision != expectedRevision.Value + 1) throw InvalidResponse();
        if (expectedClassificationInput is not null)
        {
            var expected = JsonSerializer.SerializeToElement(expectedClassificationInput, StrictJson);
            ValidateInitiativeClassificationInput(expected);
            if (classification is null || classification.InputDigest != CanonicalDigest(expected) ||
                classification.ClassifiedBy != expectedActorId)
            {
                throw InvalidResponse();
            }
        }
        if (expectedApplicabilityInput is not null)
        {
            var expected = JsonSerializer.SerializeToElement(expectedApplicabilityInput, StrictJson);
            ValidateInitiativeApplicabilityInput(expected);
            if (classification is null || applicability is null || applicability.State != "current" ||
                applicability.InitiativeRevision != revision || applicability.InputDigest != CanonicalDigest(expected) ||
                applicability.EvaluatedBy != expectedActorId ||
                applicability.ClassificationDigest != classification.Digest)
            {
                throw InvalidResponse();
            }
        }
        return new InitiativeEntryRecord(
            id,
            revision,
            productId,
            state,
            CanonicalDigest(initiative),
            classification,
            applicability);
    }

    internal static InitiativeEntryAssessment ParseInitiativeEntryAssessmentResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var assessment = ReadResult(envelope);
        if (!HasOnlyProperties(
                assessment,
                "schemaVersion", "kind", "initiativeId", "initiativeRevision", "productId", "productRevision",
                "productDigest", "classification", "applicability", "state", "reasons", "assessedAt",
                "authorityBoundary") ||
            ParseBoundedNonNegativeInt(assessment, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(assessment, "kind", "initiative-entry-assessment") != "initiative-entry-assessment" ||
            ParseRequiredEnum(assessment, "authorityBoundary", InitiativeAssessmentBoundary) != InitiativeAssessmentBoundary)
        {
            throw InvalidResponse();
        }
        var initiativeId = ParseRequiredGuid(assessment, "initiativeId");
        var initiativeRevision = ParsePositiveLong(assessment, "initiativeRevision");
        var productRevision = ParsePositiveLong(assessment, "productRevision");
        if (initiativeId != expectedInitiativeId) throw InvalidResponse();

        var classification = assessment.GetProperty("classification");
        if (!HasRequiredAndAllowedProperties(classification, ["status", "completeness"], ["digest"])) throw InvalidResponse();
        var classificationStatus = ParseRequiredEnum(classification, "status", "missing", "current", "stale");
        var classificationDigest = ParseOptionalDigest(classification, "digest");
        if ((classificationStatus == "missing") != (classificationDigest is null)) throw InvalidResponse();
        var completeness = classification.GetProperty("completeness");
        if (!HasOnlyProperties(
                completeness,
                "status", "policyVersion", "policyDigest", "unknownDimensionCount", "unresolvedQuestionCount",
                "missingConditionalDimensionCount", "confidenceSufficient"))
        {
            throw InvalidResponse();
        }
        var completenessStatus = ParseRequiredEnum(
            completeness,
            "status",
            "missing",
            "complete",
            "incomplete",
            "stale");
        var policyVersion = ParseRequiredEnum(
            completeness,
            "policyVersion",
            "gaep-initiative-classification-completeness-v1");
        if ((classificationStatus == "missing" && completenessStatus != "missing") ||
            (classificationStatus == "stale" && completenessStatus != "stale"))
        {
            throw InvalidResponse();
        }
        var parsedCompleteness = new InitiativeClassificationCompletenessAssessment(
            completenessStatus,
            policyVersion,
            ParseRequiredDigest(completeness, "policyDigest"),
            ParseBoundedNonNegativeInt(completeness, "unknownDimensionCount", 512),
            ParseBoundedNonNegativeInt(completeness, "unresolvedQuestionCount", 512),
            ParseBoundedNonNegativeInt(completeness, "missingConditionalDimensionCount", 512),
            ParseRequiredBoolean(completeness, "confidenceSufficient"));

        var applicability = assessment.GetProperty("applicability");
        if (!HasRequiredAndAllowedProperties(
                applicability,
                [
                    "status", "decisionCount", "unresolvedSubjectCount", "pendingHumanDecisionCount",
                    "blockedDecisionCount", "pendingApprovalCount", "rejectedApprovalCount", "coverage",
                ],
                ["matrixRevision", "digest"]))
        {
            throw InvalidResponse();
        }
        var applicabilityStatus = ParseRequiredEnum(applicability, "status", "missing", "current", "stale");
        long? matrixRevision = applicability.TryGetProperty("matrixRevision", out _) ? ParsePositiveLong(applicability, "matrixRevision") : null;
        var applicabilityDigest = ParseOptionalDigest(applicability, "digest");
        if ((matrixRevision is null) != (applicabilityDigest is null) ||
            (applicabilityStatus == "missing") != (matrixRevision is null))
        {
            throw InvalidResponse();
        }
        var coverage = applicability.GetProperty("coverage");
        if (!HasRequiredAndAllowedProperties(
                coverage,
                [
                    "status", "subjectCount", "coveredSubjectCount", "missingSubjectCount",
                    "unexpectedSubjectCount", "mismatchedSubjectCount",
                ],
                ["catalogVersion", "catalogDigest"]))
        {
            throw InvalidResponse();
        }
        var coverageStatus = ParseRequiredEnum(
            coverage,
            "status",
            "unavailable",
            "missing",
            "complete",
            "incomplete",
            "stale");
        var catalogVersion = coverage.TryGetProperty("catalogVersion", out _)
            ? ParseRequiredEnum(coverage, "catalogVersion", "gaep-initiative-applicability-subjects-v1")
            : null;
        var catalogDigest = ParseOptionalDigest(coverage, "catalogDigest");
        if ((catalogVersion is null) != (catalogDigest is null) ||
            (coverageStatus == "unavailable") != (catalogVersion is null))
        {
            throw InvalidResponse();
        }
        var subjectCount = ParseBoundedNonNegativeInt(coverage, "subjectCount", 512);
        var coveredSubjectCount = ParseBoundedNonNegativeInt(coverage, "coveredSubjectCount", 512);
        var missingSubjectCount = ParseBoundedNonNegativeInt(coverage, "missingSubjectCount", 512);
        var unexpectedSubjectCount = ParseBoundedNonNegativeInt(coverage, "unexpectedSubjectCount", 512);
        var mismatchedSubjectCount = ParseBoundedNonNegativeInt(coverage, "mismatchedSubjectCount", 512);
        if (coveredSubjectCount + missingSubjectCount + mismatchedSubjectCount != subjectCount ||
            (coverageStatus == "complete" &&
             (missingSubjectCount > 0 || unexpectedSubjectCount > 0 || mismatchedSubjectCount > 0)))
        {
            throw InvalidResponse();
        }
        var parsedCoverage = new InitiativeApplicabilityCoverageAssessment(
            coverageStatus,
            catalogVersion,
            catalogDigest,
            subjectCount,
            coveredSubjectCount,
            missingSubjectCount,
            unexpectedSubjectCount,
            mismatchedSubjectCount);
        var parsedApplicability = new InitiativeEntryAssessmentApplicability(
            applicabilityStatus,
            matrixRevision,
            applicabilityDigest,
            ParseBoundedNonNegativeInt(applicability, "decisionCount", 512),
            ParseBoundedNonNegativeInt(applicability, "unresolvedSubjectCount", 512),
            ParseBoundedNonNegativeInt(applicability, "pendingHumanDecisionCount", 512),
            ParseBoundedNonNegativeInt(applicability, "blockedDecisionCount", 512),
            ParseBoundedNonNegativeInt(applicability, "pendingApprovalCount", 512),
            ParseBoundedNonNegativeInt(applicability, "rejectedApprovalCount", 512),
            parsedCoverage);
        var reasons = assessment.GetProperty("reasons");
        var parsedReasons = ParseInitiativeTextArray(reasons, 0, 256);
        var state = ParseRequiredEnum(assessment, "state", "ready", "attention-required", "blocked");
        if ((state == "ready") != (parsedReasons.Count == 0)) throw InvalidResponse();
        return new InitiativeEntryAssessment(
            initiativeId,
            initiativeRevision,
            ParseRequiredGuid(assessment, "productId"),
            productRevision,
            ParseRequiredDigest(assessment, "productDigest"),
            new InitiativeEntryAssessmentClassification(classificationStatus, classificationDigest, parsedCompleteness),
            parsedApplicability,
            state,
            parsedReasons,
            ParseRequiredTimestamp(assessment, "assessedAt"));
    }

    private static IReadOnlyDictionary<string, object?> SerializeInitiativeSource(InitiativeEntrySource source)
    {
        ArgumentNullException.ThrowIfNull(source);
        var value = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["kind"] = source.Kind,
            ["reference"] = source.Reference,
        };
        if (source.Digest is not null) value["digest"] = source.Digest;
        return value;
    }

    private static IReadOnlyDictionary<string, object?> SerializeInitiativeSubject(InitiativeApplicabilitySubject subject)
    {
        ArgumentNullException.ThrowIfNull(subject);
        return new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["type"] = subject.Type,
            ["key"] = subject.Key,
            ["label"] = subject.Label,
        };
    }

    private static void ValidateInitiativeClassificationInput(JsonElement input)
    {
        if (!HasOnlyProperties(
                input,
                "primaryType", "secondaryTypes", "systemState", "changePosture", "motivations", "characteristics",
                "regulated", "policyDomains", "sensitivities", "expectedLifetime", "maintenanceHorizon", "risk",
                "dependencies", "affectedAssets", "owner", "accountableAuthority", "confidence", "evidence",
                "unresolvedQuestions", "rationale"))
        {
            throw InvalidResponse();
        }
        var primaryType = ParseInitiativeEnum(input, "primaryType", InitiativeTypes);
        var secondaryTypes = ParseInitiativeEnumArray(input.GetProperty("secondaryTypes"), 0, 29, InitiativeTypes);
        if (secondaryTypes.Distinct(StringComparer.Ordinal).Count() != secondaryTypes.Count ||
            secondaryTypes.Contains(primaryType, StringComparer.Ordinal)) throw InvalidResponse();
        ParseRequiredEnum(input, "systemState", "greenfield", "brownfield", "mixed", "unknown");
        ParseRequiredEnum(input, "changePosture", "new", "existing", "replacement", "modernization", "migration", "retirement", "mixed");
        var motivations = ParseInitiativeEnumArray(
            input.GetProperty("motivations"),
            1,
            6,
            new HashSet<string>(["business-driven", "technical", "regulatory", "operational", "security-driven", "mixed"], StringComparer.Ordinal));
        EnsureUnique(motivations);
        var characteristics = input.GetProperty("characteristics");
        if (!HasOnlyProperties(characteristics, "userInterface", "data", "integration", "interactionModes", "exposure"))
            throw InvalidResponse();
        ParseRequiredEnum(characteristics, "userInterface", "ui-bearing", "non-ui", "unknown");
        ParseRequiredEnum(characteristics, "data", "data-bearing", "stateless", "unknown");
        ParseRequiredEnum(characteristics, "integration", "integration-heavy", "isolated", "mixed", "unknown");
        var interactionModes = ParseInitiativeEnumArray(
            characteristics.GetProperty("interactionModes"),
            1,
            6,
            new HashSet<string>(["synchronous", "asynchronous", "batch", "streaming", "interactive", "mixed"], StringComparer.Ordinal));
        EnsureUnique(interactionModes);
        ParseRequiredEnum(characteristics, "exposure", "internal", "partner", "public", "mixed", "unknown");
        ParseRequiredBoolean(input, "regulated");
        EnsureUnique(ParseInitiativeIdentifierArray(input.GetProperty("policyDomains"), 64));
        var sensitivities = ParseInitiativeEnumArray(
            input.GetProperty("sensitivities"),
            1,
            8,
            new HashSet<string>(["security", "privacy", "data", "safety", "financial", "operational", "none", "unknown"], StringComparer.Ordinal));
        EnsureUnique(sensitivities);
        if (sensitivities.Contains("none", StringComparer.Ordinal) && sensitivities.Count > 1) throw InvalidResponse();
        ParseRequiredEnum(input, "expectedLifetime", "short-lived", "medium-term", "long-lived", "indefinite", "unknown");
        ParseInitiativeTextProperty(input, "maintenanceHorizon");
        var risk = input.GetProperty("risk");
        if (!HasOnlyProperties(risk, "blastRadius", "reversibility", "urgency", "costOfFailure")) throw InvalidResponse();
        ParseRequiredEnum(risk, "blastRadius", "localized", "multi-unit", "organization", "external", "unknown");
        ParseRequiredEnum(risk, "reversibility", "reversible", "partially-reversible", "irreversible", "unknown");
        ParseRequiredEnum(risk, "urgency", "low", "normal", "high", "critical", "unknown");
        ParseRequiredEnum(risk, "costOfFailure", "low", "medium", "high", "critical", "unknown");
        EnsureUnique(ParseInitiativeTextArray(input.GetProperty("dependencies"), 0, 256));
        EnsureUnique(ParseInitiativeTextArray(input.GetProperty("affectedAssets"), 0, 256));
        ParseInitiativeTextProperty(input, "owner");
        ParseInitiativeTextProperty(input, "accountableAuthority");
        var confidence = input.GetProperty("confidence");
        if (!HasOnlyProperties(confidence, "level", "basis")) throw InvalidResponse();
        ParseRequiredEnum(confidence, "level", "low", "medium", "high");
        ParseInitiativeTextProperty(confidence, "basis");
        var evidence = input.GetProperty("evidence");
        if (evidence.ValueKind != JsonValueKind.Array || evidence.GetArrayLength() is < 1 or > 256) throw InvalidResponse();
        EnsureUnique(evidence.EnumerateArray().Select(ValidateInitiativeSource).ToArray());
        EnsureUnique(ParseInitiativeTextArray(input.GetProperty("unresolvedQuestions"), 0, 256));
        ParseInitiativeTextProperty(input, "rationale", 10, 10_000);
    }

    private static void ValidateInitiativeApplicabilityInput(JsonElement input)
    {
        if (!HasRequiredAndAllowedProperties(input, ["decisions", "unresolvedSubjects"], ["subjectCatalog"]))
            throw InvalidResponse();
        if (input.TryGetProperty("subjectCatalog", out var catalog))
        {
            if (!HasOnlyProperties(catalog, "catalogVersion", "digest", "subjectCount") ||
                ParseRequiredEnum(
                    catalog,
                    "catalogVersion",
                    "gaep-initiative-applicability-subjects-v1") !=
                "gaep-initiative-applicability-subjects-v1" ||
                ParseBoundedNonNegativeInt(catalog, "subjectCount", 512) is < 1 or > 512)
            {
                throw InvalidResponse();
            }
            ParseRequiredDigest(catalog, "digest");
        }
        var decisions = input.GetProperty("decisions");
        if (decisions.ValueKind != JsonValueKind.Array || decisions.GetArrayLength() is < 1 or > 512) throw InvalidResponse();
        var decisionKeys = decisions.EnumerateArray().Select(ValidateInitiativeDecisionInput).ToArray();
        EnsureUnique(decisionKeys);
        var unresolved = input.GetProperty("unresolvedSubjects");
        if (unresolved.ValueKind != JsonValueKind.Array || unresolved.GetArrayLength() > 512) throw InvalidResponse();
        var unresolvedKeys = unresolved.EnumerateArray().Select(item =>
        {
            if (!HasOnlyProperties(item, "subject", "reason", "owner")) throw InvalidResponse();
            var key = ValidateInitiativeSubject(item.GetProperty("subject"));
            ParseInitiativeTextProperty(item, "reason");
            ParseInitiativeTextProperty(item, "owner");
            return key;
        }).ToArray();
        EnsureUnique(unresolvedKeys);
        if (unresolvedKeys.Intersect(decisionKeys, StringComparer.Ordinal).Any()) throw InvalidResponse();
    }

    private static string ValidateInitiativeDecisionInput(JsonElement decision)
    {
        if (!HasRequiredAndAllowedProperties(
                decision,
                [
                    "subject", "status", "rationale", "sources", "owner", "dependencies", "conditions",
                    "reviewTriggers", "approval", "relatedRecords", "relatedImplementationUnits",
                ],
                ["accountableApprover"]))
        {
            throw InvalidResponse();
        }
        var subjectKey = ValidateInitiativeSubject(decision.GetProperty("subject"));
        var status = ParseInitiativeEnum(decision, "status", InitiativeApplicabilityStatuses);
        ParseInitiativeTextProperty(decision, "rationale", 10, 10_000);
        var sources = decision.GetProperty("sources");
        if (sources.ValueKind != JsonValueKind.Array || sources.GetArrayLength() is < 1 or > 256) throw InvalidResponse();
        EnsureUnique(sources.EnumerateArray().Select(ValidateInitiativeSource).ToArray());
        ParseInitiativeTextProperty(decision, "owner");
        if (decision.TryGetProperty("accountableApprover", out _)) ParseInitiativeTextProperty(decision, "accountableApprover");
        EnsureUnique(ParseInitiativeIdentifierArray(decision.GetProperty("dependencies"), 256));
        var conditions = ParseInitiativeTextArray(decision.GetProperty("conditions"), 0, 256);
        EnsureUnique(conditions);
        var reviewTriggers = ParseInitiativeTextArray(decision.GetProperty("reviewTriggers"), 1, 256);
        EnsureUnique(reviewTriggers);
        EnsureUnique(ParseInitiativeIdentifierArray(decision.GetProperty("relatedImplementationUnits"), 256));
        if (status is "deferred" or "conditionally-required" or "blocked" && conditions.Count == 0)
            throw InvalidResponse();

        var approval = decision.GetProperty("approval");
        if (!HasRequiredAndAllowedProperties(approval, ["state", "conditions"], ["decidedBy", "decidedAt"]))
            throw InvalidResponse();
        var approvalState = ParseRequiredEnum(approval, "state", "not-required", "pending", "approved", "rejected");
        EnsureUnique(ParseInitiativeTextArray(approval.GetProperty("conditions"), 0, 128));
        var hasDecider = approval.TryGetProperty("decidedBy", out var decidedBy);
        var hasDecisionTime = approval.TryGetProperty("decidedAt", out _);
        var decided = approvalState is "approved" or "rejected";
        if (hasDecider != hasDecisionTime || decided != hasDecider) throw InvalidResponse();
        if (hasDecider)
        {
            ParseInitiativeHuman(decidedBy);
            ParseRequiredTimestamp(approval, "decidedAt");
        }
        if (status == "awaiting-human-decision" && approvalState != "pending") throw InvalidResponse();

        var related = decision.GetProperty("relatedRecords");
        if (related.ValueKind != JsonValueKind.Array || related.GetArrayLength() > 256) throw InvalidResponse();
        var relatedKeys = related.EnumerateArray().Select(record =>
        {
            if (!HasOnlyProperties(record, "recordType", "recordId", "revision", "digest")) throw InvalidResponse();
            var recordType = ParseInitiativeIdentifier(record.GetProperty("recordType"));
            var recordId = ParseRequiredGuid(record, "recordId");
            var revision = ParsePositiveLong(record, "revision");
            ParseRequiredDigest(record, "digest");
            return $"{recordType}:{recordId:D}:{revision}";
        }).ToArray();
        EnsureUnique(relatedKeys);
        if (status is "already-satisfied" or "reused" && relatedKeys.Length == 0) throw InvalidResponse();
        return subjectKey;
    }

    private static InitiativeClassificationView ParseInitiativeClassification(JsonElement classification)
    {
        string[] inputNames =
        [
            "primaryType", "secondaryTypes", "systemState", "changePosture", "motivations", "characteristics",
            "regulated", "policyDomains", "sensitivities", "expectedLifetime", "maintenanceHorizon", "risk",
            "dependencies", "affectedAssets", "owner", "accountableAuthority", "confidence", "evidence",
            "unresolvedQuestions", "rationale",
        ];
        if (!HasRequiredAndAllowedProperties(
                classification,
                [
                    .. inputNames,
                    "productProfile", "productRevision", "productDigest", "classifiedBy", "classifiedAt",
                    "authorityBoundary",
                ],
                ["completenessPolicyVersion", "completenessPolicyDigest"]))
        {
            throw InvalidResponse();
        }
        var input = CopyInitiativeProperties(classification, inputNames);
        ValidateInitiativeClassificationInput(input);
        if (ParseRequiredEnum(classification, "authorityBoundary", InitiativeClassificationBoundary) !=
            InitiativeClassificationBoundary) throw InvalidResponse();
        var completenessPolicyVersion = classification.TryGetProperty("completenessPolicyVersion", out _)
            ? ParseRequiredEnum(
                classification,
                "completenessPolicyVersion",
                "gaep-initiative-classification-completeness-v1")
            : null;
        var completenessPolicyDigest = ParseOptionalDigest(classification, "completenessPolicyDigest");
        if ((completenessPolicyVersion is null) != (completenessPolicyDigest is null)) throw InvalidResponse();
        return new InitiativeClassificationView(
            ParseInitiativeEnum(input, "primaryType", InitiativeTypes),
            ParseRequiredEnum(
                classification,
                "productProfile",
                "software", "saas", "ai-enabled", "integration", "security-sensitive", "data-sensitive",
                "internal-tool", "mobile"),
            ParsePositiveLong(classification, "productRevision"),
            ParseRequiredDigest(classification, "productDigest"),
            completenessPolicyVersion,
            completenessPolicyDigest,
            ParseInitiativeHuman(classification.GetProperty("classifiedBy")),
            ParseRequiredTimestamp(classification, "classifiedAt"),
            CanonicalDigest(classification),
            CanonicalDigest(input));
    }

    private static InitiativeApplicabilityView ParseInitiativeApplicability(
        JsonElement matrix,
        Guid expectedInitiativeId,
        Guid expectedProductId)
    {
        if (!HasRequiredAndAllowedProperties(
                matrix,
                [
                    "decisions", "unresolvedSubjects", "schemaVersion", "kind", "revision", "initiativeId",
                    "productId", "initiativeRevision", "classificationDigest", "state", "evaluatedBy", "evaluatedAt",
                    "authorityBoundary",
                ],
                ["subjectCatalog", "invalidatedAt", "invalidationReason"]) ||
            ParseBoundedNonNegativeInt(matrix, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(matrix, "kind", "initiative-applicability-matrix") != "initiative-applicability-matrix" ||
            ParseRequiredEnum(matrix, "authorityBoundary", InitiativeMatrixBoundary) != InitiativeMatrixBoundary ||
            ParseRequiredGuid(matrix, "initiativeId") != expectedInitiativeId ||
            ParseRequiredGuid(matrix, "productId") != expectedProductId)
        {
            throw InvalidResponse();
        }
        var revision = ParsePositiveLong(matrix, "revision");
        var initiativeRevision = ParsePositiveLong(matrix, "initiativeRevision");
        var evaluatedBy = ParseInitiativeHuman(matrix.GetProperty("evaluatedBy"));
        var decisions = matrix.GetProperty("decisions");
        if (decisions.ValueKind != JsonValueKind.Array || decisions.GetArrayLength() is < 1 or > 512) throw InvalidResponse();
        string[] decisionInputNames =
        [
            "subject", "status", "rationale", "sources", "owner", "dependencies", "conditions", "reviewTriggers",
            "approval", "relatedRecords", "relatedImplementationUnits",
        ];
        var decisionInputs = new List<IReadOnlyDictionary<string, object?>>();
        foreach (var decision in decisions.EnumerateArray())
        {
            if (!HasRequiredAndAllowedProperties(
                    decision,
                    [
                        .. decisionInputNames,
                        "id", "revision", "initiativeRevision", "decidedBy", "decidedAt", "authorityBoundary",
                    ],
                    ["accountableApprover"]))
            {
                throw InvalidResponse();
            }
            ParseRequiredGuid(decision, "id");
            ParsePositiveLong(decision, "revision");
            if (ParsePositiveLong(decision, "initiativeRevision") != initiativeRevision ||
                ParseInitiativeHuman(decision.GetProperty("decidedBy")) != evaluatedBy ||
                ParseRequiredEnum(decision, "authorityBoundary", InitiativeDecisionBoundary) != InitiativeDecisionBoundary)
            {
                throw InvalidResponse();
            }
            ParseRequiredTimestamp(decision, "decidedAt");
            var names = decision.TryGetProperty("accountableApprover", out _)
                ? [.. decisionInputNames, "accountableApprover"]
                : decisionInputNames;
            decisionInputs.Add(CopyInitiativePropertiesDictionary(decision, names));
        }
        InitiativeApplicabilitySubjectCatalogBinding? subjectCatalog = null;
        JsonElement? subjectCatalogElement = null;
        if (matrix.TryGetProperty("subjectCatalog", out var rawSubjectCatalog))
        {
            if (!HasOnlyProperties(rawSubjectCatalog, "catalogVersion", "digest", "subjectCount"))
                throw InvalidResponse();
            var catalogVersion = ParseRequiredEnum(
                rawSubjectCatalog,
                "catalogVersion",
                "gaep-initiative-applicability-subjects-v1");
            var subjectCount = ParseBoundedNonNegativeInt(rawSubjectCatalog, "subjectCount", 512);
            if (subjectCount is < 1 or > 512) throw InvalidResponse();
            subjectCatalog = new InitiativeApplicabilitySubjectCatalogBinding(
                catalogVersion,
                ParseRequiredDigest(rawSubjectCatalog, "digest"),
                subjectCount);
            subjectCatalogElement = rawSubjectCatalog.Clone();
        }
        var inputDictionary = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["decisions"] = decisionInputs,
            ["unresolvedSubjects"] = matrix.GetProperty("unresolvedSubjects").Clone(),
        };
        if (subjectCatalogElement.HasValue) inputDictionary["subjectCatalog"] = subjectCatalogElement.Value;
        var input = JsonSerializer.SerializeToElement(inputDictionary, StrictJson);
        ValidateInitiativeApplicabilityInput(input);
        var state = ParseRequiredEnum(matrix, "state", "current", "stale");
        var invalidatedAt = ParseOptionalTimestamp(matrix, "invalidatedAt");
        var invalidationReason = matrix.TryGetProperty("invalidationReason", out _)
            ? ParseInitiativeTextProperty(matrix, "invalidationReason")
            : null;
        if ((state == "stale") != (invalidatedAt.HasValue && invalidationReason is not null)) throw InvalidResponse();
        return new InitiativeApplicabilityView(
            revision,
            initiativeRevision,
            state,
            decisionInputs.Count,
            matrix.GetProperty("unresolvedSubjects").GetArrayLength(),
            ParseRequiredDigest(matrix, "classificationDigest"),
            subjectCatalog,
            evaluatedBy,
            ParseRequiredTimestamp(matrix, "evaluatedAt"),
            CanonicalDigest(matrix),
            CanonicalDigest(input));
    }

    private static string ParseInitiativeHuman(JsonElement actor)
    {
        if (!HasOnlyProperties(actor, "kind", "id") ||
            ParseRequiredEnum(actor, "kind", "human") != "human" ||
            !actor.TryGetProperty("id", out var idElement) || idElement.ValueKind != JsonValueKind.String)
        {
            throw InvalidResponse();
        }
        var id = idElement.GetString();
        if (id is null || id != id.Trim() || id.Length > 256 || !ActorIdPattern().IsMatch(id)) throw InvalidResponse();
        return id;
    }

    private static string ValidateInitiativeSource(JsonElement source)
    {
        if (!HasRequiredAndAllowedProperties(source, ["kind", "reference"], ["digest"])) throw InvalidResponse();
        var kind = ParseInitiativeEnum(source, "kind", InitiativeSourceKinds);
        var reference = ParseInitiativeTextProperty(source, "reference");
        var digest = ParseOptionalDigest(source, "digest") ?? string.Empty;
        return $"{kind}:{reference}:{digest}";
    }

    private static string ValidateInitiativeSubject(JsonElement subject)
    {
        if (!HasOnlyProperties(subject, "type", "key", "label")) throw InvalidResponse();
        var type = ParseInitiativeEnum(subject, "type", InitiativeSubjectTypes);
        var key = ParseInitiativeIdentifier(subject.GetProperty("key"));
        ParseInitiativeTextProperty(subject, "label");
        return $"{type}:{key}";
    }

    private static string ParseInitiativeEnum(JsonElement element, string name, HashSet<string> allowed)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String ||
            value.GetString() is not { } parsed || !allowed.Contains(parsed)) throw InvalidResponse();
        return parsed;
    }

    private static IReadOnlyList<string> ParseInitiativeEnumArray(
        JsonElement value,
        int minimum,
        int maximum,
        HashSet<string> allowed)
    {
        if (value.ValueKind != JsonValueKind.Array || value.GetArrayLength() < minimum || value.GetArrayLength() > maximum)
            throw InvalidResponse();
        return Array.AsReadOnly(value.EnumerateArray().Select(item =>
        {
            if (item.ValueKind != JsonValueKind.String || item.GetString() is not { } parsed || !allowed.Contains(parsed))
                throw InvalidResponse();
            return parsed;
        }).ToArray());
    }

    private static IReadOnlyList<string> ParseInitiativeIdentifierArray(JsonElement value, int maximum)
    {
        if (value.ValueKind != JsonValueKind.Array || value.GetArrayLength() > maximum) throw InvalidResponse();
        return Array.AsReadOnly(value.EnumerateArray().Select(ParseInitiativeIdentifier).ToArray());
    }

    private static string ParseInitiativeIdentifier(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.String || value.GetString() is not { } parsed ||
            !InitiativeIdentifierPattern().IsMatch(parsed)) throw InvalidResponse();
        return parsed;
    }

    private static IReadOnlyList<string> ParseInitiativeTextArray(JsonElement value, int minimum, int maximum)
    {
        if (value.ValueKind != JsonValueKind.Array || value.GetArrayLength() < minimum || value.GetArrayLength() > maximum)
            throw InvalidResponse();
        return Array.AsReadOnly(value.EnumerateArray().Select(item => ParseInitiativeText(item, 2, 2_000)).ToArray());
    }

    private static void ValidateInitiativeTextArray(JsonElement value, int minimum, int maximum) =>
        ParseInitiativeTextArray(value, minimum, maximum);

    private static string ParseInitiativeTextProperty(
        JsonElement element,
        string name,
        int minimum = 2,
        int maximum = 2_000)
    {
        if (!element.TryGetProperty(name, out var value)) throw InvalidResponse();
        return ParseInitiativeText(value, minimum, maximum);
    }

    private static string ParseInitiativeText(JsonElement value, int minimum, int maximum)
    {
        if (value.ValueKind != JsonValueKind.String || value.GetString() is not { } text || text != text.Trim() ||
            text.Length < minimum || text.Length > maximum || text.Any(char.IsControl) ||
            HandoffPathPattern().IsMatch(text) || SecretPattern().IsMatch(text)) throw InvalidResponse();
        return text;
    }

    private static void EnsureUnique(IReadOnlyCollection<string> values)
    {
        if (values.Distinct(StringComparer.Ordinal).Count() != values.Count) throw InvalidResponse();
    }

    private static JsonElement CopyInitiativeProperties(JsonElement source, IReadOnlyList<string> names) =>
        JsonSerializer.SerializeToElement(CopyInitiativePropertiesDictionary(source, names), StrictJson);

    private static IReadOnlyDictionary<string, object?> CopyInitiativePropertiesDictionary(
        JsonElement source,
        IReadOnlyList<string> names) =>
        names.ToDictionary(name => name, name => (object?)source.GetProperty(name).Clone(), StringComparer.Ordinal);

    [GeneratedRegex("^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex InitiativeIdentifierPattern();
}
