# DOWNSTREAM NOTICE id:20261024-181351-password-input-autocomplete-required
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T18:13:51+09:00
severity: action-required
checkpoint: password-input-autocomplete-required
change: `autoComplete` is now REQUIRED on PasswordInput (both @/components/Form/Input/Manual and @/components/Form/Input/Controlled), typed `PasswordAutoComplete = "current-password" | "new-password"` (exported from @/components/Form/Input/Manual). Upstream call sites without it were filled: EditPassword (current / new), AdminUserManageModal AuthTabContent, AdminDemoUserCreateForm, AdminGeneralUserCreateForm, AdminManagerialUserCreateForm, FieldRenderer's passwordInput (inputResolver) = "new-password"; demo form = "current-password". Login / registration / reset already had it.
why: Without autoComplete, browsers (Safari in particular) guess the field's role. On admin screens that set ANOTHER user's password, the admin's own saved password gets autofilled and submitted as that user's password; on change-password screens password managers cannot tell current from new. Every fork must declare the role at each PasswordInput; after merging, PasswordInput without autoComplete fails `pnpm typecheck`.
required_actions:
1. Merge upstream up to this checkpoint (take upstream on conflicts in the files listed above).
2. Run `pnpm typecheck`. Every error `Property 'autoComplete' is missing ... PasswordAutoComplete` is a fork PasswordInput. Also list them with `grep -rn "<PasswordInput" src` (check each match for an autoComplete prop).
3. For each one, add `autoComplete` by the field's role:
   - the user types a password they ALREADY have (login, re-auth, "current password" on a change screen, password confirmation before a dangerous action) → `autoComplete="current-password"`
   - the user CHOOSES a new password (signup, reset, "new password" / "confirm new password" on a change screen) → `autoComplete="new-password"`
   - an admin / staff sets or resets SOMEONE ELSE's password (admin user edit / create, staff console, seed or demo user forms) → `autoComplete="new-password"` (never current-password: that autofills the operator's own password)
4. Run `pnpm typecheck` again until it passes.
verify: `pnpm typecheck` passes | `grep -rn "<PasswordInput" src` → every match has an autoComplete prop (check with `grep -rn -A6 "<PasswordInput" src`) | in Safari, an admin user-edit password field stays empty instead of autofilling the admin's own password
manual_steps: -
refs: src/components/Form/Input/Manual/PasswordInput.tsx (PasswordAutoComplete) | src/components/Form/Input/Controlled/PasswordInput.tsx | src/components/Form/README.md (input table) | order 20261019-122328-fork-extension-points-bundle item (12)
notes: No DB change, no db:push. | Raw `<input type="password">` is not covered by the type check; if the fork has any (`grep -rn 'type="password"' src`), give them autoComplete by the same rule. | Domain forms rendered by FieldRenderer (domain.json passwordInput) get "new-password" from upstream automatically; no dc:generate needed.
