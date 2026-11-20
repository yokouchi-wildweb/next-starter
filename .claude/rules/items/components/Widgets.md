---
paths:
  - "src/components/Widgets/**"
---
# components/Widgets
what: interactive widgets: InfiniteScrollList (the display switch of an infinite-scroll list), ScrollSlider (Embla) and FadeSlider (crossfade) with one state contract, and their shared SliderArrow / SliderDots; each a unit @/components/Widgets/\<Part\> (shared parts, hooks and types in the unit SliderParts, @/components/Widgets/SliderParts)
use: always
change: none → /order <direct parent>
rules:
using:
- list_retry: InfiniteScrollList adds the retry button itself under errorNode and after a failed load-more → never put retry inside errorNode
- list_other_layout: a layout that does not render `items` (grouped view etc.) branches outside InfiniteScrollList
- list_scroll_root: a list inside its own scroll container passes that container as the hook's observerOptions.root
- list_remove_items: removeItems only for rows the server no longer returns, never to hide rows (they come back on the next load)
- list_prepend_position: direction="prepend" with auto load leaves the scroll position to browser scroll anchoring | a screen that handles position itself loads by button
- list_look: look (spinner, texts, spacing) changes through the *Node props, never by editing the part
editing:
- list_default_look: the default contents (initial Spinner, footer Spinner + 「読み込み中...」) stay as they are: fork screens rely on them
read: build an infinite list → src/components/Widgets/InfiniteScrollList/README.md Usage | list props → src/components/Widgets/InfiniteScrollList/README.md API | sliders → src/components/Widgets/ScrollSlider/README.md Usage, src/components/Widgets/FadeSlider/README.md Usage | slider props → src/components/Widgets/ScrollSlider/README.md API
