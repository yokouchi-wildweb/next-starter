---
paths:
  - "src/domains/core/admin/**"
  - "src/config/domains/admin.config.ts"
  - "src/**/plugs/{adminBulkActions,adminDashboardSections,adminMenuCategories,adminMenuItems}/**"
---
# domains/admin
what: admin screen parts: sidebar menu (menu/), /admin dashboard (dashboard/, entry @/domains/admin/dashboard), fetch bodies of admin list / edit / create / sort (services/server/screenData/)
use: always
change: add = menu categories / items, dashboard sections as items in your own domain's plugs/<point>/ (admin's points) | override = <key>.override.ts beside an upstream entry | counterpart = src/config/domains/admin.config.ts
rules:
using:
- entry_key_name: an entry's file name = its `key` (camelCase), an override targets it
- order_between: a fork's entry takes an order between the upstream values
- allow_roles_narrow: an override's allowRoles only narrows (empty = widening)
- data_menu_off: keep a domain out of the data menu by addToAdminDataMenu: false in domain.json, never on the menu side
- section_fetch_in_load: a dashboard section fetches only in its `load`; its Section gets the result as `data`
- section_list_server: a Client Component never imports the section list or plugs/adminDashboardSections/
- dashboard_config_scope: adminConfig.dashboard switches serve the upstream sections only, never a fork's section
editing:
- no_own_switch: menu rows and sections show by the feature gate and allowRoles, no new menu- or dashboard-only on/off (show*: dashboard_config_scope)
- upstream_roles_on_items: upstream default allowRoles go on menu items, never on upstream categories
- order_gaps: upstream orders keep gaps (categories, sections 100, items 10; inserts: midpoint)
- screen_data_no_cache: screenData holds no cache() or authz (the caller's createLoader owns both)
- relation_options_single: which relations to read and their SWR key live only in relationOptions.mjs
read: menu entry → src/domains/core/admin/menu/README.md Extension | dashboard section → src/domains/core/admin/dashboard/README.md Extension | admin screen loader → src/domains/core/admin/services/server/screenData/README.md Usage
