# frozen_string_literal: true

# GAEP-P0-CS01-C1 — shared lifecycle rules for pre-implementation change reports.
#
# This helper is the single source of the report/register lifecycle consistency rule. It is
# required by both scripts/validate_next_docs.rb and scripts/test/lifecycle_consistency_test.rb
# so the rule can be tested without executing the validator script.
module ReportLifecycle
  ALLOWED_STATUSES = [
    "Awaiting Approval",
    "Approved",
    "In Implementation",
    "Implemented — Ready for Test",
    "Accepted",
    "Withdrawn"
  ].freeze

  # Statuses that mean the change set has moved past approval; a report still advertising a
  # live "Awaiting Approval" state would contradict them.
  POST_APPROVAL_STATUSES = ["Approved", "In Implementation", "Implemented — Ready for Test", "Accepted"].freeze

  # Extract the `| **Status** | ... |` field from a report body.
  def self.report_status(report_text)
    match = report_text[/^\|\s*\*\*Status\*\*\s*\|\s*(.+?)\s*\|/, 1]
    match&.strip
  end

  # Extract the Status column for a given report file name from the register table.
  def self.register_status(register_text, report_file_name)
    register_text.each_line do |line|
      next unless line.include?("(#{report_file_name})")

      cells = line.split("|").map(&:strip)
      # | ID | Phase | Title | Report | Status | Approved on | Handoff |
      return cells[5] if cells.length > 5
    end
    nil
  end

  # Return a list of human-readable inconsistencies (empty means consistent).
  def self.inconsistencies(report_text, register_status)
    findings = []
    status = report_status(report_text)

    if status.nil?
      findings << "missing '| **Status** | ... |' field"
    elsif ALLOWED_STATUSES.none? { |allowed| status.include?(allowed) }
      findings << "report Status '#{status}' is not an allowed operational-report status"
    end

    if register_status.nil? || register_status.empty?
      findings << "missing register Status for this report"
    elsif ALLOWED_STATUSES.none? { |allowed| register_status.include?(allowed) }
      findings << "register Status '#{register_status}' is not an allowed operational-report status"
    end

    if status && register_status
      post_approval = POST_APPROVAL_STATUSES.any? { |value| register_status.include?(value) }
      if post_approval && status.include?("Awaiting Approval")
        findings << "register Status '#{register_status}' contradicts report Status '#{status}'"
      end
      # A post-approval change set must not still END with a live approval-request marker.
      # (Historical/quoted mentions inside the body are fine; only the trailing state counts.)
      if post_approval
        last_line = report_text.lines.map(&:strip).reject(&:empty?).last
        if last_line&.include?("AWAITING PRODUCT OWNER APPROVAL")
          findings << "register Status '#{register_status}' contradicts a live trailing 'AWAITING PRODUCT OWNER APPROVAL' marker"
        end
      end
    end

    findings
  end
end
