---
paths:
  - "src/components/Functional/**"
---
# components/Functional
what: parts that wrap a behavior and draw little or nothing: DarkModeSwitch (site theme toggle, reads @/lib/siteTheme), FirebaseAnalytics (page views after consent, @/lib/analyticsConsent), entry @/components/Functional/<Part>
use: always
change: none → /order <direct parent> (theme areas = src/config/lib/siteTheme.config.ts, analytics on / off = its lib config)
rules:
using:
editing:
- behavior_only: a part here holds a behavior, not a look; a part that mostly draws goes to its category (Form, Overlays, Layout …)
- lib_reads: theme and analytics state come from their libs' entries (@/lib/siteTheme, @/lib/analyticsConsent), never a store of their own here
read: none (no README; each part's head comment explains it: src/components/Functional/DarkModeSwitch.tsx, FirebaseAnalytics.tsx; the category list is in src/components/README.md, theme sync in src/lib/siteTheme/README.md)
