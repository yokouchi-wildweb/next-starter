---
paths:
  - "src/lib/spacing/**"
---
# lib/spacing
what: the spacing scale (none…4xl), the spacing prop types (SpacingValue, BoxSpacingProps) and the value → class lookup over the generated class table; entry @/lib/spacing
use: always
change: counterpart → token values `--space-*` in `:root` of any root src/styles/*.css (the tokens live in src/styles/core/config.css) | the scale itself: none → /order <direct parent>
rules:
using:
- spacing_entry: import `@/lib/spacing` only, never a file inside
- spacing_lookup: a part turns a spacing value into classes with spacingClassName / boxSpacingClassName, never by building class strings (Tailwind emits literal classes only)
editing:
- spacing_scale_source: names and px live only in spacingScale.ts | the px match the upstream token defaults (src/styles/core/styleTokens.test.mjs)
- spacing_table: spacingClasses.generated.ts = pnpm generate styles output (scripts/structure/styles/generate-spacing-classes.ts), never hand-edited
read: functions, types → API | the class table, tokens → Internals
