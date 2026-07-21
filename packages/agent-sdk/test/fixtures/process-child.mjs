const mode = process.argv[2]

if (mode === "split-output") {
  process.stdout.write("out-one")
  setTimeout(() => process.stderr.write("err-two"), 10)
  setTimeout(() => process.stdout.write("-out-three"), 20)
} else if (mode === "overflow") {
  process.stdout.write("A".repeat(32))
  process.stderr.write("B".repeat(32))
  setInterval(() => {}, 1_000)
} else if (mode === "ignore-sigterm") {
  process.on("SIGTERM", () => process.stdout.write("ignored-term"))
  setInterval(() => {}, 1_000)
} else if (mode === "timeout") {
  setInterval(() => {}, 1_000)
} else {
  process.stderr.write(`unknown fixture mode: ${String(mode)}`)
  process.exitCode = 2
}
