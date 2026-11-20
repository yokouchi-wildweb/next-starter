---
paths:
  - "src/lib/siteTheme/**"
  - "src/config/lib/siteTheme.config.ts"
---
# lib/siteTheme
what: light / dark site theme decided per path area (@/lib/siteTheme): pure resolvers, the <head> bootstrap script, store + SiteThemeSync, config, useDarkModeSwitch (state + toggle for a theme button; the caller draws the button)
use: always
change: overlay = src/config/lib/siteTheme.config.ts (storageKey, areas, fallback)
rules:
using:
- single_sync: put exactly one SiteThemeSync in the root layout | never touch <html> class / data-area from outside
- literal_override: the override file holds literal values only, no functions
editing:
- internal_dom: dom.ts and useSiteThemeSync stay inside the lib (not exported from the entry)
- side_effects: package.json gets no sideEffects field (the store is created on import)
read: what it is → Overview | mount, toggle → Usage | exports → API | areas config → Extension | writer, sideEffects → Internals
