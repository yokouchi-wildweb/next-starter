---
paths:
  - "src/components/Admin/**"
---
# components/Admin
what: admin screen parts, props only: ListTop (list top row), SecTitle (admin section heading), SearchBox / SelectFilter / SortSelect (URL query controls), ItemNavigator (edit-page item switcher), entries @/components/Admin/<Name> (no index.ts)
use: always
change: none → /order <direct parent>
rules:
using:
- list_header: an admin list's top row = ListTop with its controls as children, never a hand-built title row
- url_controls: SearchBox / SelectFilter / SortSelect write the URL query through makeHref | the list reads its state from the URL, never from their local state
- item_navigation: ItemNavigator data = useDomainItemNavigation (@/lib/crud) | admin edit pages place src/app/admin/_layout/AdminEditItemNavigator, not a new pairing
editing:
- props_only: parts here hold no data access (no hooks of a domain, no fetch) | data comes from the caller
- admin_sec_title_slot: SecTitle keeps slot="admin-sec-title" (frame parts list src/app/_layout/frame/parts.mjs reads this file)
- frame_elsewhere: the admin frame (header, sidebar, AdminPage) lives in src/app/admin/_layout/, never here
read: pick a part → Overview | makeHref, list header, ItemNavigator → Usage
