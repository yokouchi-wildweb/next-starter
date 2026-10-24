---
paths:
  - "src/**/*.tsx"
  - "src/hooks/**"
---
# COMPONENTS
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /upreq) | FORMAT_RULE applies

wrappers (raw HTML NG): div → Layout/{Block,Flex,Grid,Stack} | main → Layout/Main or UserPage | section → Layout/Section | button → Form/Button | input → Form/Input | p → TextBlocks/Para | h2 → TextBlocks/SecTitle | skeleton → Skeleton/BaseSkeleton | img → Media/AppImage (never next/image directly)
- never import _shadcn directly (wrapper table: src/components/_shadcn/README.md; no wrapper → propose one)
text_blocks_inherit: TextBlocks do not inherit like raw tags → Span directly inside a heading = `size="inherit" weight="inherit"` | Para in a centered parent = `align="center"` | ref: src/components/TextBlocks/README.md
ui_layers (page / section_container / part, defined by role; ref: docs/!must-read/UIレイヤーの概念とコンポーネント分割方法.md):
- page = page.tsx switch + Screen (see SCREENS): no hooks, no state, h1 only here
- section_container = what a Screen places directly: features/\<domain\>/components/\<Name\> (no *Page/*Screen/*Section suffix) | calls hooks, HTTP only via hooks | top-level props = contract | a Screen imports the container, never its inside
- part = everything inside a container, not contract | hooks in a part only when fully self-contained | call hooks at the upper layer, pass handlers via props
- data_seam: first-paint data = loader → container prop `initial<Name>` → hook `fallbackData` + `revalidateOnMount: fallbackData === undefined || <SWR cache has the key>` | background data = hook only
forms: FieldRenderer (ref: src/components/Form/FieldRenderer/README.md) | programmatic value = input type hidden (no UI) or custom (own UI); none = excluded from the schema
async_select: async pickers MUST consume Form/Input/Manual/AsyncOptionSource (never re-implement browse/search paging) | form field → AsyncComboboxInput / AsyncMultiSelectInput (users: UserAsyncCombobox / UserAsyncMultiSelect) | modal opened from an action button → AsyncPickerModal (users: useUserAsyncOptionSource, features/core/user)
async_feedback (MUST): every client background request (mutation / submit / sync) shows loading: button spinner, local ScreenLoader or loading toast | prefer Dialog / ConfirmPopover Promise handling and useAsyncAction (src/hooks, double-fire lock) | exception: fire-and-forget tracking
infinite_scroll: use @/components/Widgets/InfiniteScrollList fed by @/hooks/useInfiniteScrollQuery | never build your own sentinel or an isLoading early return (it blanks the list on load-more)
action_optimistic: an action that changes list items returns the processed IDs → onSuccess calls updateItems / removeItems | revalidate only when the response cannot describe the change | never reset to refresh (it empties the list)
kiosk / device hooks: non-scrolling one-screen pages and src/hooks device hooks (wake lock, fullscreen, orientation, useMediaQuery) → read src/components/AppFrames/Kiosk/README.md | page_controls: AppFrames/User/controls/ (used in the Screen)
