# DOWNSTREAM NOTICE id:20261020-163000-untrack-claude-settings-local
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-20T16:30:00+09:00
severity: action-required
checkpoint: untrack-claude-settings-local
change: `.claude/settings.local.json` is no longer tracked (git rm --cached) and is listed in .gitignore. Permission mode is a per-person choice and lives in each user's `~/.claude/settings.json` (e.g. `"permissions": { "defaultMode": "bypassPermissions" }`), never in the repo.
why: the tracked file carried one machine's permissions (Bash(*), absolute-path one-off approvals) to every fork; Claude Code appends every "don't ask again" approval to it, so each upstream session overwrote fork permissions on merge, or the merge was refused when the fork had local edits. Its `defaultMode: "acceptEdits"` also overrides a user-level defaultMode (local scope wins for scalar keys).
required_actions:
1. Before merging this interval: if `.claude/settings.local.json` exists, copy it outside the repository (e.g. `cp .claude/settings.local.json /tmp/settings.local.json.bak`).
2. Merge upstream. On a modify/delete conflict for `.claude/settings.local.json`, resolve with `git rm --cached .claude/settings.local.json` (keep upstream's untrack). On a .gitignore conflict keep both sides.
3. If `.claude/settings.local.json` is now missing from the working tree, restore it from the backup of step 1.
4. If `git ls-files .claude/settings.local.json` still prints the path, run `git rm --cached .claude/settings.local.json` and make sure `.claude/settings.local.json` is in .gitignore, then commit.
5. In the local file, delete the `permissions.defaultMode` key (it overrides the user's `~/.claude/settings.json` mode). Other content may stay; it is now machine-local.
verify: `git ls-files .claude/settings.local.json` prints nothing; `git check-ignore .claude/settings.local.json` prints the path; the working copy exists if it existed before the merge.
manual_steps: each person who wants Claude Code to run without permission prompts sets it once in their own `~/.claude/settings.json` (`"permissions": { "defaultMode": "bypassPermissions" }`, `"skipDangerousModePermissionPrompt": true`, `"enableAllProjectMcpServers": true`). bypassPermissions in project or local settings is ignored by Claude Code.
refs: .gitignore, upstream-request 20261020-052252-untrack-settings-local-json, https://code.claude.com/docs/en/settings#settings-precedence
notes: the shared `.claude/settings.json` (WebFetch / WebSearch allow) stays tracked. Forks: not checked.
