# DOWNSTREAM NOTICE id:20261111-160028-bottom-nav-menu-slot
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-11T16:00:28+09:00
severity: info
checkpoint: bottom-nav-menu-slot
change: The bottom-nav menu item (BottomNavMenuEntry, the button that opens an action menu) now carries data-slot="bottom-nav-item", the same mark as the link items; its id="bottom-nav-item-<key>" stays. It comes through the typed slot of the Primitives Button: ButtonSlot = "button" | CarouselButtonSlot | FrameButtonSlot (FrameButtonSlot = "bottom-nav-item", not exported; the mark is owned by the user frame, src/app/(user)/_layout/README.md, and is not in the Primitives list). Form/Button accepts an optional slot?: ButtonSlot and forwards it (no slot -> "button", as before). Every other Button / Form/Button / Carousel button renders as before.
why: forks could not target the menu item by data-slot (Form/Button set its own data-slot="button" and a caller data-slot loses on purpose); they now can
required_actions: none
verify: -
manual_steps: -
refs: src/components/Primitives/Button/Button.tsx, src/components/Form/Button/Button.tsx, src/app/(user)/_layout/BottomNav/BottomNavItem.tsx, src/app/(user)/_layout/README.md (data-slot の一覧), order 20261111-155745-bottom-nav-menu-slot
notes: Forks (read-only git grep): no CSS targets bottom-nav-item; boardgame-site has its own copy src/app/(user)/_components/BottomNavItem.tsx (not changed by this; its menu item keeps what its copy renders). Fork CSS may now use [data-slot="bottom-nav-item"] for both link and menu items; selectors on #bottom-nav-item-<key> keep working. A fork CSS rule written for [data-slot="bottom-nav-item"] that relied on not matching the menu item will now also apply to it.
