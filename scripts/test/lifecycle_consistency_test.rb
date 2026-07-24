#!/usr/bin/env ruby
# frozen_string_literal: true

# GAEP-P0-CS01-C1 — executable proof that contradictory report/register lifecycle states fail
# and reconciled records pass. Requires only the shared helper (never the executable validator).
require "pathname"

require_relative "../lib/report_lifecycle"

FIXTURES = Pathname.new(__dir__).join("fixtures", "lifecycle")

failures = []

def check(failures, label, condition)
  failures << label unless condition
  puts "#{condition ? 'ok  ' : 'FAIL'} #{label}"
end

contradictory_report = FIXTURES.join("contradictory_report.md").read
contradictory_register = FIXTURES.join("contradictory_register.md").read
reconciled_report = FIXTURES.join("reconciled_report.md").read
reconciled_register = FIXTURES.join("reconciled_register.md").read

contradictory_status = ReportLifecycle.register_status(contradictory_register, "contradictory_report.md")
reconciled_status = ReportLifecycle.register_status(reconciled_register, "reconciled_report.md")

check(failures, "register status is parsed from the register table",
      contradictory_status == "Implemented — Ready for Test")

contradictory_findings = ReportLifecycle.inconsistencies(contradictory_report, contradictory_status)
check(failures, "a contradictory report/register pair is rejected", !contradictory_findings.empty?)

reconciled_findings = ReportLifecycle.inconsistencies(reconciled_report, reconciled_status)
check(failures, "a reconciled report/register pair passes", reconciled_findings.empty?)

if failures.empty?
  puts "lifecycle consistency: PASS"
else
  warn "lifecycle consistency: FAIL (#{failures.length})"
  exit 1
end
