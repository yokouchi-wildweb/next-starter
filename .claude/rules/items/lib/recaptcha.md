---
paths:
  - "src/lib/recaptcha/**"
  - "src/config/lib/recaptcha.config.ts"
---
# lib/recaptcha
what: Google reCAPTCHA v3 / v2 hybrid bot guard | closed lib: entries @/lib/recaptcha (client token, v2 challenge, parts, action names, site keys, config types) and @/lib/recaptcha/server (verify, per-version internals with the secret, debug) | RecaptchaProvider is mounted by src/wiring/AppProviders.tsx
use: always (off while the env keys are empty or shorter than 20 chars)
change: placement = src/config/lib/recaptcha.config.ts (v3 / v2 siteKey as the NEXT_PUBLIC_* literal, secretKey as a zero-arg env function; upstream reads the same env names as before)
rules:
using:
- badge_terms: the badge is hidden → every form that uses reCAPTCHA shows RecaptchaBadge (Google's terms)
- thresholds: thresholds live in the using place's config, never in the lib
- separate_keys: v3 and v2 use different site keys
- internals: RECAPTCHA_V3_INTERNALS / RECAPTCHA_V2_INTERNALS are not used directly
editing:
- actions_here: action names are added to RECAPTCHA_ACTIONS in constants.ts
- no_env_in_lib: the lib never reads process.env; keys arrive through the override, the secret function is called only inside ./server
read: what, setup, client, server, v2 challenge → Usage | exports → API | thresholds, flow, score → Internals
