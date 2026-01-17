# behavior

## WORK_RULES (HIGHEST_PRIORITY)
- work_only_on_instructed_scope: true
- no_preemptive_implementation: true
- planning_and_implementation_separated: true
- await_approval_before_implementation: true
- propose_before_modifying_core_files: true
- language_for_comments_and_docs: japanese
- cross_domain_awareness: before implementing, check if other domains need changes. proactively propose changes in the correct domain rather than placing logic in the wrong domain for convenience
- avoid_piped_commands: run commands without pipes to avoid permission prompts. use file arguments instead (e.g. grep pattern file.txt, not cat file.txt | grep pattern)
- avoid_brace_expansion: never use shell brace expansion {A,B} syntax. permission system evaluates raw string before expansion. use separate paths or multiple commands instead (e.g. mkdir -p dir/A dir/B, not mkdir -p dir/{A,B})
- never_commit_without_explicit_instruction: true. never commit unless explicitly requested
- never_push_db_without_explicit_instruction: true. never run db push/migrate commands (e.g. drizzle-kit push, drizzle-kit migrate). always ask user to run manually
- never_use_enter_plan_mode: true. never use EnterPlanMode tool. plan tasks using TodoWrite instead
