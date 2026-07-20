#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "json"
require "open3"
require "optparse"
require "pathname"
require "yaml"

ROOT = Pathname.new(__dir__).join("..").expand_path
ROOT_MEMBERS = %w[
  .gitignore
  README.md
  CONTRIBUTING.md
  LICENSE_STATUS.md
  SECURITY.md
  CHANGELOG.md
].freeze
TOOL_MEMBERS = %w[
  scripts/validate_next_docs.rb
  scripts/build_candidate_revision_set.rb
].freeze

options = {
  formal: false,
  allow_dirty_draft: false,
  purpose: nil,
  owner_role: "GAEP Candidate Baseline Proposer"
}

parser = OptionParser.new do |opts|
  opts.banner = "Usage: ruby scripts/build_candidate_revision_set.rb [options]"
  opts.on("--formal", "Assemble a clean, exact Candidate Revision Set manifest") { options[:formal] = true }
  opts.on("--allow-dirty-draft", "Permit a non-formal working-tree snapshot") { options[:allow_dirty_draft] = true }
  opts.on("--candidate-set-id ID", "Canonical Candidate Revision Set identity") { |value| options[:candidate_set_id] = value }
  opts.on("--purpose TEXT", "Declared set purpose") { |value| options[:purpose] = value }
  opts.on("--owner-role ROLE", "Accountable assembly role type") { |value| options[:owner_role] = value }
end

begin
  parser.parse!(ARGV)
rescue OptionParser::ParseError => e
  warn e.message
  warn parser
  exit 64
end

unless ARGV.empty?
  warn "unexpected arguments: #{ARGV.join(' ')}"
  warn parser
  exit 64
end

def git(*args)
  output, error, status = Open3.capture3("git", *args, chdir: ROOT.to_s)
  unless status.success?
    warn "git #{args.join(' ')} failed: #{error.strip}"
    exit 65
  end
  output.strip
end

git_root = Pathname.new(git("rev-parse", "--show-toplevel")).expand_path
unless git_root == ROOT
  warn "repository root mismatch: expected #{ROOT}, got #{git_root}"
  exit 65
end

status_text = git("status", "--porcelain=v1", "--untracked-files=all")
worktree_clean = status_text.empty?

if options[:formal]
  if options[:allow_dirty_draft]
    warn "--allow-dirty-draft cannot be combined with --formal"
    exit 64
  end
  unless worktree_clean
    warn "formal Candidate Revision Set assembly requires a clean worktree"
    exit 66
  end
  if options[:candidate_set_id].to_s.strip.empty?
    warn "--candidate-set-id is required with --formal"
    exit 64
  end
  if options[:purpose].to_s.strip.empty?
    warn "--purpose is required with --formal"
    exit 64
  end
elsif !worktree_clean && !options[:allow_dirty_draft]
  warn "working tree is dirty; pass --allow-dirty-draft to emit a non-formal snapshot"
  exit 66
end

options[:purpose] ||= "pre-implementation working-candidate inspection"

candidate_documents = ROOT.join("docs", "next").glob("**/*.md").map { |path| path.relative_path_from(ROOT).to_s }
member_paths = (ROOT_MEMBERS + candidate_documents + TOOL_MEMBERS).uniq.sort

members = member_paths.map do |relative|
  path = ROOT.join(relative).cleanpath
  unless path.to_s.start_with?(ROOT.to_s + File::SEPARATOR) && path.file?
    warn "candidate member is missing or outside the repository: #{relative}"
    exit 65
  end

  member = {
    "path" => relative,
    "sha256" => Digest::SHA256.file(path).hexdigest,
    "bytes" => path.size
  }

  if relative.start_with?("docs/next/") && path.extname == ".md"
    text = path.read
    closing = text.index("\n---\n", 4) if text.start_with?("---\n")
    if closing
      metadata = YAML.safe_load(text[4...closing], permitted_classes: [], aliases: false) || {}
      member["document_id"] = metadata["id"]
      member["document_version"] = metadata["version"]
      member["document_status"] = metadata["status"]
      member["approval_state"] = metadata.dig("approval", "state")
      member["normative_level"] = metadata["normative_level"]
    end
  end

  member
end

membership_lines = members.map { |member| "#{member.fetch('sha256')}  #{member.fetch('path')}\n" }
membership_digest = Digest::SHA256.hexdigest(membership_lines.join)
status_digest = Digest::SHA256.hexdigest(status_text.empty? ? "clean\n" : "#{status_text}\n")
candidate_set_id = options[:candidate_set_id] || "urn:gaep:candidate-set:draft:#{membership_digest[0, 16]}"

manifest = {
  "schema_version" => "1.0",
  "record_type" => "candidate-revision-set-manifest",
  "designation" => options[:formal] ? "candidate-revision-set" : "draft-working-tree-snapshot",
  "candidate_set_id" => candidate_set_id,
  "set_revision" => "sha256:#{membership_digest}",
  "purpose" => options[:purpose],
  "owner_role" => options[:owner_role],
  "approval_state" => "not-approved",
  "authority_effect" => "none",
  "baseline_effect" => "none",
  "implementation_effect" => "none",
  "repository" => {
    "branch" => git("branch", "--show-current"),
    "storage_commit" => git("rev-parse", "HEAD"),
    "worktree_clean" => worktree_clean,
    "status_sha256" => status_digest
  },
  "membership" => {
    "algorithm" => "sha256(sorted(<member-sha256><two spaces><repository-relative-path><newline>))",
    "member_count" => members.length,
    "digest" => "sha256:#{membership_digest}",
    "members" => members
  },
  "inclusions" => [
    "docs/next/**/*.md",
    "root governance and repository text files declared by the validator",
    "candidate documentation validation and set-manifest tooling"
  ],
  "exclusions" => [
    "legacy docs outside docs/next, retained as separately version-bound migration sources",
    "Git metadata and branch names as authority",
    "runtime, platform implementation, deployment, production data, and external-system state"
  ],
  "declarations" => [
    "membership and digest create no approval, baseline, authority, conformance, or implementation meaning",
    "a formal manifest still requires an effective proposer, independent review, an Approval Case, an Approval Determination, and separately authorized baseline designation",
    "changing one member byte or path creates a different set revision"
  ]
}

puts JSON.pretty_generate(manifest)
