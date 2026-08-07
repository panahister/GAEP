import { describe, expect, it } from "vitest"

import {
  acceptSourceFoundationProposal,
  isSourceFoundationProposalState,
  setSourceFoundationProposalPhase,
  startSourceFoundationProposal,
} from "./source-foundation-proposal.js"

const digest = `sha256:${"a".repeat(64)}`

describe("Source foundation proposal", () => {
  it("keeps a Baseline candidate non-governed until separate acceptance and commit", () => {
    const proposal = startSourceFoundationProposal({
      checkpoint: "source-baseline",
      initiativeId: "initiative-1",
      initiativeRevision: 3,
      sourceCount: 2,
      sourceTitles: ["requirements.md", "stories.xlsx"],
      sourceMembershipDigest: digest,
      adoptedCandidate: {
        coverage: "partially-supported",
        evidence: "The document set contains an explicit precedence note.",
        candidateProposal: "Use requirements and stories as the candidate functional baseline.",
        missingDecisions: "Confirm document precedence.",
        evidenceDigest: digest,
        proposalDigest: digest,
      },
    })

    expect(proposal.phase).toBe("proposal")
    expect(acceptSourceFoundationProposal(proposal).phase).toBe("review")
    expect(setSourceFoundationProposalPhase(acceptSourceFoundationProposal(proposal), "committed").phase).toBe("committed")
    expect(isSourceFoundationProposalState(proposal)).toBe(true)
  })

  it("requires an exact current Baseline binding for a Provenance proposal", () => {
    const proposal = startSourceFoundationProposal({
      checkpoint: "source-provenance",
      initiativeId: "initiative-1",
      initiativeRevision: 3,
      sourceCount: 1,
      sourceTitles: ["requirements.md"],
      sourceMembershipDigest: digest,
      baseline: { revision: 2, memberCount: 1, membershipDigest: digest },
    })

    expect(isSourceFoundationProposalState(proposal)).toBe(true)
    expect(isSourceFoundationProposalState({ ...proposal, baseline: undefined })).toBe(false)
  })
})
