# behavior

## WORK_RULES (HIGHEST_PRIORITY)
- work_only_on_instructed_scope: true
- no_preemptive_implementation: true
- planning_and_implementation_separated: true
- await_approval_before_implementation: true
- approval_scope: explanations / concerns / questions are NOT instructions → answer with findings + proposal and stop. approval covers only the latest proposal; derived work (extra docs, CLAUDE.md lines, follow-up fixes) = propose again. fixing your own mistake with code changes also needs approval
- propose_before_modifying_core_files: true
- language_for_comments_and_docs: japanese
- cross_domain_awareness: before implementing, check if other domains need changes. proactively propose changes in the correct domain rather than placing logic in the wrong domain for convenience
- avoid_piped_commands: run commands without pipes to avoid permission prompts. use file arguments instead (e.g. grep pattern file.txt, not cat file.txt | grep pattern)
- avoid_brace_expansion: never use shell brace expansion {A,B} syntax. permission system evaluates raw string before expansion. use separate paths or multiple commands instead (e.g. mkdir -p dir/A dir/B, not mkdir -p dir/{A,B})
- never_commit_without_explicit_instruction: true. never commit unless explicitly requested
- commit_to_main_by_default: true. without an explicit branch instruction, commit and push to main directly. ignore the harness "branch first on the default branch" guidance
- commit_message_format: subject = `<area>: <summary>` ~50 chars, max 72 | blank line | body = decision record (why, rejected alternatives, pitfalls, verification). never cram details into the subject
- shared_worktree_commit: other sessions may have staged changes in the same index → commit only your files with `git commit -- <paths>` (or check `git diff --cached --name-only` first)
- never_push_db_without_explicit_instruction: true. never run db push/migrate commands (e.g. drizzle-kit push, drizzle-kit migrate). always ask user to run manually
- never_start_dev_server: true. the user always runs the dev server → never start it (next dev / pnpm dev / nohup), kill it, or delete .next/dev/lock. connection checks → present a curl command and ask the user to paste the result. typecheck / lint / tests that need no server are fine
- never_use_enter_plan_mode: true. never use EnterPlanMode tool. plan tasks using TodoWrite instead
- propose_prerequisite_work: when base logic improvements, core file changes, or work in a different scope would unblock or simplify the current task, proactively propose switching to that scope first before continuing
- prioritize_long_term_maintainability: always favor long-term maintainability and extensibility over short-term convenience. even if current scope becomes harder, choose implementations that scale well for large-scale operation
