// GAEP-P0-CS02 — minimal, dependency-free ZIP central-directory reader. Rider plugin ZIPs and VSIX
// packages are both ZIP containers, so this lists their entries to prove the embedded Engine Host
// SEA and its digest sidecar are actually present in the shipped archive (INV-22 content verification).
import { readFileSync } from "node:fs"

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50

/** List the file entry names inside a ZIP archive by parsing its central directory. */
export function listZipEntries(archivePath) {
  const buffer = readFileSync(archivePath)
  // Locate the End Of Central Directory record (scan backwards; it is within the last 64 KiB + 22).
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0 && i >= buffer.length - 22 - 0x10000; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) { eocd = i; break }
  }
  if (eocd < 0) throw new Error("Not a valid ZIP archive: no End Of Central Directory record")
  const entryCount = buffer.readUInt16LE(eocd + 10)
  let pointer = buffer.readUInt32LE(eocd + 16)
  const names = []
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(pointer) !== CENTRAL_SIGNATURE) {
      throw new Error("Corrupt ZIP central directory")
    }
    const nameLength = buffer.readUInt16LE(pointer + 28)
    const extraLength = buffer.readUInt16LE(pointer + 30)
    const commentLength = buffer.readUInt16LE(pointer + 32)
    names.push(buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength))
    pointer += 46 + nameLength + extraLength + commentLength
  }
  return names
}

/** True when the archive contains every one of the required entry basenames. */
export function archiveContainsAll(archivePath, requiredBasenames) {
  const present = new Set(listZipEntries(archivePath).map((name) => name.split("/").pop()))
  return requiredBasenames.every((basename) => present.has(basename))
}
