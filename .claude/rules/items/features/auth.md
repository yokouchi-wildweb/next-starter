---
paths:
  - "src/features/core/auth/**"
  - "src/config/features/auth.config.ts"
---
# features/auth
what: sign-in, registration (pre → full), JWT session, user deps of the page / API guards (@/features/auth/<path>, no barrel) | users, status, roles = user
use: always | signup: the gate rule signup
change: placement = src/config/features/auth.config.ts | screens: _components/ calling the public hooks
rules:
using:
- one_account_per_provider: identity = (provider_type, provider_uid), never merge by email | admins and users share one users table
- new_sign_in: verify identity → userService.createFromProvider → establishSession, never copy their status / signing / cookie code | audit = their user.registered / user.rejoined
- provider_types: USER_PROVIDER_TYPES only | missing kind → /order, never extend the enum
- extra_reject: extra refusals → caller, before createFromProvider
- after_signup: post-registration work → a user_registered milestone, never edit registration.ts
- screen_hooks: rebuilt auth screens call the public hooks, render their form | never import hooks/registration, signup, oauth/transition
- ui_session: UI shows the user from useAuthSession only
- token_only: getTokenOnlySession (stale claims) never decides authz (audit actor, demo)
editing:
- db_authority: JWT = identity only, status / role / name from the DB | re-issue signs DB values, never old claims
- session_order: status branch → last login → token → cookie | a refusal writes nothing
- invalidation_boundary: the comparison lives only in session/invalidationBoundary.ts
- hook_contract: hook names, args, returns, form fields = contract, change → notice
- no_consent_default: upstream has no marketing checkbox and no consent default
- referral_param: invite params in mails only while referral is open (route+service)
read: accounts → Overview | flows, new sign-in → Usage | endpoints, mails → API | hooks, means → src/features/core/auth/API.md API | config → Extension | session, guards → Internals
