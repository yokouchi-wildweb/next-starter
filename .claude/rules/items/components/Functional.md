---
paths:
  - "src/components/Functional/**"
---
# components/Functional
what: parts that wrap a behavior and draw little or nothing: BodyPortal / HeadPortal (portal into body / head after mount), DarkModeSwitch (site theme toggle, reads @/lib/siteTheme), FirebaseAnalytics (page views after consent, @/lib/analyticsConsent), entry @/components/Functional/<Part>
use: always
change: none → /order <direct parent> (theme areas = src/config/lib/siteTheme.config.ts, analytics on / off = its lib config)
rules:
using:
- portal_choice: a piece that must escape its ancestors' stacking → BodyPortal, or the container prop of the overlay part that already has one (core/components.md stacking and portal)
- portal_client_only: BodyPortal / HeadPortal draw nothing before mount (useIsClient) → never rely on their children in server-rendered markup
editing:
- behavior_only: a part here holds a behavior, not a look; a part that mostly draws goes to its category (Form, Overlays, Layout …)
- lib_reads: theme and analytics state come from their libs' entries (@/lib/siteTheme, @/lib/analyticsConsent), never a store of their own here
read: none (no README; each part's head comment explains it: src/components/Functional/BodyPortal.tsx, HeadPortal.tsx, DarkModeSwitch.tsx, FirebaseAnalytics.tsx; the category list is in src/components/README.md, theme sync in src/lib/siteTheme/README.md)
