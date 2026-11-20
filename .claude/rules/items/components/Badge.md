---
paths:
  - "src/components/Badge/**"
---
# components/Badge
what: the badge parts SolidBadge, SoftBadge, BookmarkTagBadge with shared variant / size / icon / asChild props, each a unit @/components/Badge/\<Part\> (shared variant / size types in badge-variants)
use: always
change: placement → colors = semantic tokens in src/styles/palette.css | shape (radius, padding, border) = `badge` key of src/config/lib/variantOverrides.config.ts (size / solid / soft / bookmarkTag)
rules:
using:
- badge_source: a badge comes from @/components/Badge/\<Part\> | BadgeCore (@/components/Primitives/Badge) directly only when the finished badges fall short (Primitives card finished_first)
- badge_interactive: a clickable or link badge = `asChild` over Form/Button or LinkButton with `variant="none" size="none"`, never a raw button / a styled as a badge | the general rule = core/components.md as_child_interactive
- badge_as_child_single: the asChild child is one React element (no text only, several elements or Fragment: Slot throws at runtime)
editing:
- badge_core: a new badge delegates asChild (Slot) and icon drawing to BadgeCore (@/components/Primitives/Badge), never its own Slot branch
- badge_variant_kind: a new badge implements BadgeVariantStyles, puts badgeOverrideClasses(kind, variant, size) into its className join and adds the kind to BadgeKind (badge-variants.ts) and to the badge keys of src/lib/variantOverrides (types.ts, defineConfig.ts)
read: pick and use a badge → Usage | props, variants → API | downstream look → Extension | BadgeCore, SoftBadge layers → Internals
