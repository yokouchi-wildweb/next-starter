---
paths:
  - "src/components/Badge/**"
---
# components/Badge
what: the badge parts SolidBadge, SoftBadge, BookmarkTagBadge with shared variant / size / icon / asChild props, entry @/components/Badge
use: always
change: placement → colors = semantic tokens in src/styles/palette.css | shape (radius, padding, border) = `badge` key of src/config/ui/variants.config.ts (size / solid / soft / bookmarkTag)
rules:
using:
- badge_source: a badge comes from @/components/Badge, never _shadcn/badge directly
- badge_interactive: a clickable or link badge = `asChild` over Form/Button or LinkButton with `variant="none" size="none"`, never a raw button / a styled as a badge
- badge_as_child_single: the asChild child is one React element (no text only, several elements or Fragment: Slot throws at runtime)
editing:
- badge_core: a new badge delegates asChild (Slot) and icon drawing to BadgeCore (@/components/Primitives/Badge), never its own Slot branch
- badge_variant_kind: a new badge implements BadgeVariantStyles, puts badgeOverrideClasses(kind, variant, size) into its className join and adds the kind to the variants.config.ts type
read: pick and use a badge → Usage | props, variants → API | downstream look → Extension | BadgeCore, SoftBadge layers → Internals
