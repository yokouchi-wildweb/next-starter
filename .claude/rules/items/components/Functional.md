---
paths:
  - "src/components/Functional/**"
---
# components/Functional
what: parts that wrap a behavior and draw little or nothing: DarkModeSwitch (site theme toggle, reads @/lib/siteTheme), each a unit @/components/Functional/\<Part\> | Firebase page views moved out of the shelf: src/app/_mounts/FirebaseAnalytics (it reads @/lib/firebase)
use: always
change: none → /order <direct parent> (theme areas = src/config/lib/siteTheme.config.ts, analytics on / off = its lib config)
rules:
using: none of its own (read a part from its unit file)
editing:
- behavior_only: a part here holds a behavior, not a look; a part that mostly draws goes to its category (Form, Overlays, Layout …)
- lib_reads: theme state comes from its lib's entry (@/lib/siteTheme), never a store of its own here | a part that needs an SDK lib (@/lib/firebase …) is not a shelf part → src/app/_mounts/ (lint import-boundaries/shelf-purity)
read: none (no README; each part's head comment explains it: src/components/Functional/DarkModeSwitch.tsx; the category list is in src/components/README.md, theme sync in src/lib/siteTheme/README.md)
