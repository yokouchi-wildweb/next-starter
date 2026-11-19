---
paths:
  - "src/**/*.tsx"
  - "src/hooks/**"
  - "src/components/**"
---
# components
> **ROLE**: loaded when writing any .tsx or shared hook | holds COMPONENTS detail
> Tier1-owned: forks never edit (gap → /order <direct parent>)

placement: multi-domain → src/components/ | layout frame parts → app/\<route\>/_layout/ (README there; components/AppFrames/ still holds a few shared frame parts, e.g. Kiosk) | ref: src/components/README.md
- single-domain section container → features/\<domain\>/components/\<Name\> | single-domain shared part → features/\<domain\>/components/common/ | default-Screen-only part → app/\<route\>/_screen/ | fork page-only part of an upstream route it replaces → app/\<route\>/_components/ (a route of its own → _screen/, core/screens.md)
wrappers (lint raw-elements): div → Layout/{Block,Flex,Grid,Stack} | main → Layout/Main or UserPage | section → Layout/Section | button → Form/Button | input → Form/Input | p → TextBlocks/Para | h2 → TextBlocks/SecTitle | skeleton → Skeleton/BaseSkeleton | img → Media/AppImage (never next/image directly)
- never import _shadcn directly outside src/components/** and src/lib/** (lint import-boundaries/no-shadcn-direct, all tiers; wrapper table: src/components/_shadcn/README.md; no wrapper → propose one)
- spacing: never space-y / space-x classes → Layout/Stack `gap` (spacing scale none..4xl, src/components/Layout/README.md)
- as_child_interactive: a clickable thing drawn as another part (badge, card) = `asChild` over Form/Button or a link part, never a raw button / a styled to look like it
- shelf_no_guard: shelf parts (src/components) never import the gate or a guard lib | judgments come in from outside through a provider / port
- primitives_last: Primitives/* only for what the finished parts cannot build
existing_parts (want → part; check here before building your own | a row = a want where own builds were found, or a choice moved here from CLAUDE.md):
- loading: inside a button → Form/Button loading prop (+ loadingLabel) | in the flow of a page or card → Overlays/Loading/InlineLoader | over an area or the screen → Overlays/Loading/ScreenLoader
- table (@/lib/tableSuite): read-only list, column sort, row reorder → DataTable | select rows + bulk actions → RecordSelectionTable | inline cell edit → EditableGridTable | growing rows → the tables' infiniteFooter prop (InfiniteTableFooter) fed by useInfiniteScrollQuery | print → DataTable variant "print" | client sort → sortItems (getValue, nulls)
- key / value rows → Overlays/DetailModal DetailTable
- admin list of a core domain with columns of your own → its columns function + list hook with DataTable in your _components/ (coupon: createAdminCouponListColumns, useAdminCouponListTable; referral: createAdminInviteListColumns, useAdminInviteListTable)
- selection outside a table (cards, tiles) → useRecordSelection + BulkActionBar, or RecordSelectionList (@/lib/tableSuite)
- paging: links → Navigation/Pagination makeHref prop | state → Pagination onPageChange prop | growing list → Widgets/InfiniteScrollList + useInfiniteScrollQuery (a button → loadMode "button", chat → direction "prepend")
- overlay: confirm → Overlays/Dialog (third action → extraAction prop) or Overlays/Confirm useConfirm (Promise) | generic → Overlays/Modal (fullscreen, overlayClassName, container props) | from an edge → Overlays/Sheet (side) | tabs → Overlays/TabbedModal | media + rows → Overlays/DetailModal | image → Overlays/ImageViewer (caption prop) | pick N from a large master → Overlays/AsyncPickerModal
- inline overlay: confirm / prompt / actions / checklist / info → Overlays/Popover | hover → Overlays/Tooltip, Overlays/HoverCard | toast → @/lib/toast
- stacking and portal: stacking → @/lib/zLayer names via zLayerClass (floating pieces take no layer) | portal → Fanctional/BodyPortal or a part's container prop
- tabs: state → Navigation/StateTabs (variant "underline", listEnd prop) | routes → Navigation/PageTab
- link → Navigation/Link | image → Media/AppImage (style, data-* pass through)
- none fits → the part's look props or slots (slots) | a missing behavior → /order <direct parent> | or build your own, never blocked (an instead-of mark is optional, own_mark in core/extensions.md) | the bans elsewhere in this file are misuses of a shared part, not bans on building your own
text_blocks_inherit: TextBlocks do not inherit like raw tags → Span directly inside a heading = `size="inherit" weight="inherit"` | Para in a centered parent = `align="center"` | ref: src/components/TextBlocks/README.md
ui_layers (page / section_container / part, defined by role; ref: docs/!must-read/UIレイヤーの概念とコンポーネント分割方法.md):
- page = page.tsx switch + Screen (see SCREENS): no hooks, no state, h1 only here
- section_container = what a Screen places directly: features/\<domain\>/components/\<Name\> (no *Page/*Screen/*Section suffix) | calls hooks, HTTP only via hooks | top-level props = contract | a Screen imports the container, never its inside
- part = 1 visual unit or 1 data shape: display part = props only | data / flow = hooks | hooks in a part only when fully self-contained | call hooks at the upper layer, pass handlers via props
- slots (what a part may take besides values, by owner): optional, default output = today's | the part keeps the behavior
  - src/components and libs: look props (className, overlayClassName, variant) and content slots (renderX functions, xNode) are allowed
  - core domain parts: value props and children only (no render function, no named ReactNode / component prop)
  - core default containers and screens: no named slot | a fork recomposes from exported parts and hooks | what upstream screens mount and a fork cannot move → a receptacle
- core parts (core_ui): every part is public, no private / public split | entry only: nobody imports a file inside components/\<Name\>/ or common/\<Part\>/ from outside that folder (lint core-ui-entry, all tiers; type-only imports exempt) | a part others need → export it from the entry | a fork copying a container points its imports at the entries
- core_ui_guards: a core part never holds form state, guards (useForm, reCAPTCHA, getIdToken, useAuthSession refreshSession, useGuardedNavigation) or data calls (useSWR*, client functions) → the owner domain's public hook in features/\<domain\>/hooks returns form + handlers, the part only renders (contract table = the domain README)
  - lint core-ui-guards: upstream only (error), off in forks | allowlist eslint-rules/core-ui-guards.allow.mjs only shrinks: hook a part → delete its line (any build / any work) | test: pnpm test eslint-rules/core-ui-guards.test.mjs
- bundle_marker: a folder with package.json sideEffects:false (auth Signup, user components/admin, userProfile entities/profiles) holds no side-effect modules (css import, registration call): an unused re-export is dropped from the bundle, side effects with it
- data_seam: first-paint data = loader → container prop `initial<Name>` → hook `fallbackData` + `revalidateOnMount: fallbackData === undefined || <SWR cache has the key>` | background data = hook only
forms: FieldRenderer (ref: src/components/Form/FieldRenderer/README.md) | programmatic value = input type hidden (no UI) or custom (own UI); none = excluded from the schema
- form schemas: never in entities/schema.ts (the entity's schema) → formEntities.ts next to the form
custom_inputs: own input part → register src/wiring/formInputs/inputs/\<name\>.ts, then formInput: "\<name\>" in domain.json / profile / setting / FieldConfig (render only; builtin names = src/lib/domain/fields/formInputs.mjs) | one-screen insert = custom + beforeField | ref: src/wiring/formInputs/inputs/README.md
domain_config: client = \<domain\>/entities/display.ts domainDisplay (pnpm generate registry, allowlisted keys only), never import domain.json (lint client-no-domain-json) | server, one domain = its own domain.json + normalizeDomainJsonConfig | server, all domains = @/wiring/domainConfig (domainConfigRegistry is server-only) | ref: src/lib/domain/README.md
async_select: async pickers MUST consume Form/Input/Manual/AsyncOptionSource (never re-implement browse/search paging) | form field → AsyncComboboxInput / AsyncMultiSelectInput (users: UserAsyncCombobox / UserAsyncMultiSelect) | modal opened from an action button → AsyncPickerModal (users: useUserAsyncOptionSource, features/core/user)
async_feedback (MUST): every client background request (mutation / submit / sync) shows loading: button spinner, local ScreenLoader or loading toast | prefer Dialog / ConfirmPopover Promise handling and useAsyncAction (src/hooks, double-fire lock) | exception: fire-and-forget tracking
infinite_scroll: use @/components/Widgets/InfiniteScrollList fed by @/hooks/useInfiniteScrollQuery | never build your own sentinel or an isLoading early return (it blanks the list on load-more)
- modes: offset (fetcher: page / limit → {results, total}) = small or bounded lists | cursor (cursorFetcher: cursor / limit → CursorPage {items, nextCursor} from @/hooks/cursorPage) = growing lists (notifications, logs, history): no COUNT, rows added during reading never shift the position, removeItems needs no correction | total in cursor mode = loaded count
action_optimistic: an action that changes list items returns the processed IDs → onSuccess calls updateItems / removeItems | revalidate only when the response cannot describe the change | never reset to refresh (it empties the list)
kiosk / device hooks: non-scrolling one-screen pages and src/hooks device hooks (wake lock, fullscreen, orientation, useMediaQuery) → read src/components/AppFrames/Kiosk/README.md | hide frame parts / fill per route: frame.ts beside the route (frame.override.ts in a lower repo) → read src/app/_layout/frame/README.md
