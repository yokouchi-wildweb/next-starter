# DOWNSTREAM NOTICE id:20261123-111914-admin-sp-sidebar-focus
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-23T11:19:14+09:00
severity: info
checkpoint: admin-sp-sidebar-focus
fixes: 20261117-104950-overlay-parts
resolves: 20261121-042432-admin-sp-sidebar-submenu-on-open
change: the admin SP sidebar (src/app/admin/(protected)/_layout/Sidebar/SpSidebar.tsx, Overlays/Sheet) now puts the open auto-focus on the sheet panel itself (onOpenAutoFocus: preventDefault + focus the role=dialog panel). Radix's default focused the first non-link tabbable = the first category, whose onFocus opened its submenu, so at 375px the left flyout covered the backdrop on every open. Right after the sheet opens no submenu is open; Tab into the menu, hover, click and Enter/Space open submenus as before; the PC sidebar and BaseSidebar are unchanged
why: since notice 20261117-104950-overlay-parts the Sheet moves focus on open, and BaseSidebar opens a category on focus
required_actions: none
verify: pnpm test "src/app/admin/(protected)/_layout/Sidebar/SpSidebar.render.test.tsx" passes (no submenu right after open, focus on a category still opens it) | at 375px /admin the menu sheet opens with no submenu
manual_steps: -
refs: src/app/admin/_layout/README.md (Sidebar/) | src/components/Overlays/Sheet/README.md (onOpenAutoFocus)
notes: a fork that replaced the SP sidebar content (content prop) gets the same focus handling | a temporary permit citing the resolved order expires with this notice
