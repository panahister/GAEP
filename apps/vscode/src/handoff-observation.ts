import type { Handoff } from "@gaep/contracts"

export const handoffDirectoryEntryLimit = 10_000
export const handoffReadLimit = 200
export const handoffRecordByteLimit = 16 * 1024 * 1024
export const handoffAggregateByteLimit = 64 * 1024 * 1024

export interface PortableHandoffObservation {
  records: Handoff[]
  total: number
  selectedFileCount: number
  omittedOutsideWindow: number
  omittedForResourceSafety: number
  platformAttestationUnavailable: boolean
}

export interface PortableHandoffObservationReader {
  read(name: string, maxBytes: number): Promise<
    | { status: "read"; record: Handoff; byteLength: number }
    | { status: "omitted" }
  >
}

export async function observePortableHandoffs(
  names: readonly string[],
  reader: PortableHandoffObservationReader,
): Promise<PortableHandoffObservation> {
  if (names.length > handoffDirectoryEntryLimit) {
    throw new Error(`Portable handoff observation exceeds the ${handoffDirectoryEntryLimit}-record safety limit`)
  }
  const selectedNames = [...names]
    .sort((left, right) => left.toLowerCase().localeCompare(right.toLowerCase()) || left.localeCompare(right))
    .slice(0, handoffReadLimit)
  const records: Handoff[] = []
  let observedBytes = 0
  let omittedForResourceSafety = 0
  for (const name of selectedNames) {
    const remainingBytes = handoffAggregateByteLimit - observedBytes
    if (remainingBytes <= 0) {
      omittedForResourceSafety += 1
      continue
    }
    const outcome = await reader.read(name, Math.min(handoffRecordByteLimit, remainingBytes))
    if (outcome.status === "omitted" || !Number.isSafeInteger(outcome.byteLength) || outcome.byteLength < 0 ||
        outcome.byteLength > handoffRecordByteLimit || outcome.byteLength > remainingBytes) {
      omittedForResourceSafety += 1
      continue
    }
    const { record } = outcome
    if (`${record.id}.json`.toLowerCase() !== name.toLowerCase()) {
      throw new Error("A governed handoff filename does not match its record identity")
    }
    observedBytes += outcome.byteLength
    records.push(record)
  }
  return {
    records: records.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    total: names.length,
    selectedFileCount: selectedNames.length,
    omittedOutsideWindow: names.length - selectedNames.length,
    omittedForResourceSafety,
    platformAttestationUnavailable: false,
  }
}
