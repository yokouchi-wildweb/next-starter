---
paths:
  - "src/components/TextBlocks/**"
---
# components/TextBlocks
what: the text wrappers PageTitle (h1), SecTitle (h2, `as` h1-h6), Para (p), Span (span) with tone / size / weight / align / srOnly variants, entry @/components/TextBlocks
use: always
change: placement → look = `pageTitle` / `secTitle` / `para` / `span` keys of src/config/lib/variantOverrides.config.ts | heading look = fork CSS on the data-slot marks
rules:
using:
- screen_h1: a screen's h1 = the frame's title part (e.g. UserPageTitle of src/app/(user)/_layout/PageTitle), not PageTitle directly
- inherit_defaults: defaults do not inherit like raw tags (core/components.md text_blocks_inherit) | lint style-tokens/span-in-heading flags a Span directly inside a heading without size / weight (error in upstream UI, warn downstream) | a centered parent is not linted → check the parent's text-align when a raw p becomes Para
- line_height: change line height with `leading-*` in className (a size class drops the base leading-relaxed)
- heading_restyle: a fork restyles headings by their data-slot marks, never renames them | the `slot` prop is only for the upstream wrappers drawing the same element (AdminPageTitleHeading, components/Admin/SecTitle)
editing:
- heading_slot_notice: removing or renaming a data-slot mark → notice | src/components/TextBlocks/headingSlots.test.tsx guards it (/ship runs it)
read: pick a part, inline / inherit cases → Usage | variant values → API | downstream look, data-slot marks → Extension | slot precedence, leading → Internals | tests → Verification
