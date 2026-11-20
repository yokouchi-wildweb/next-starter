---
paths:
  - "src/components/Navigation/**"
---
# components/Navigation
what: the navigation parts: the shelf Link (next/link wrapper that hides links to closed features) with its port LinkVisibilityProvider, route tabs PageTab (SolidTabs / UnderlineTabs), state tabs StateTabs, Pagination and the move port NavigationPort | each a unit @/components/Navigation/\<Part\>
use: always
change: none → /order <direct parent>
rules:
using:
- link_via_shelf: every link = Link from @/components/Navigation/Link, never `next/link` imported directly (lint import-boundaries/link-via-shelf: error upstream, warn in forks on files holding a closable address)
- link_gate_escape: a link that must show while its feature is closed = `gate="always"`, never a raw next/link
editing:
- link_single_wrapper: Link/index.tsx is the only file that imports next/link
- shelf_no_guard: the shelf never imports the gate or a guard lib | judgments come in from outside through LinkVisibilityProvider (hide or show) and NavigationPortProvider (move judgment, router, unsaved source), wired by the app | the general rule = core/components.md shelf_no_guard
- ports_separate: the visibility port and the move port stay separate, never one merged port
read: write a link → src/components/Navigation/Link/README.md Usage | gate values, href judgment → src/components/Navigation/Link/README.md API | the two ports → src/components/Navigation/Link/README.md Extension | app wiring, lint strength and limits → src/components/Navigation/Link/README.md Internals
