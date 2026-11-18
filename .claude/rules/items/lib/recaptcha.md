---
paths:
  - "src/lib/recaptcha/**"
---
# lib/recaptcha
what: Google reCAPTCHA v3 / v2 hybrid bot guard: client token + v2 challenge (@/lib/recaptcha), server verify (@/lib/recaptcha/server), action names (@/lib/recaptcha/constants) | RecaptchaProvider is mounted by src/wiring/AppProviders.tsx
use: always (off while the env keys are empty or shorter than 20 chars)
change: none → /order <direct parent>
rules:
using:
- badge_terms: the badge is hidden → every form that uses reCAPTCHA shows RecaptchaBadge (Google's terms)
- thresholds: thresholds live in the using place's config, never in the lib
- separate_keys: v3 and v2 use different site keys
- internals: RECAPTCHA_V3_INTERNALS / RECAPTCHA_V2_INTERNALS are not used directly
editing:
- actions_here: action names are added to RECAPTCHA_ACTIONS in constants.ts
read: what, setup, client, server, v2 challenge → Usage | exports → API | thresholds, flow, score → Internals
