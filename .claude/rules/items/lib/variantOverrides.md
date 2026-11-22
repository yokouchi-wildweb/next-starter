---
paths:
  - "src/lib/variantOverrides/**"
  - "src/config/lib/variantOverrides.config.ts"
---
# lib/variantOverrides
what: the downstream shape overrides of shelf parts (Button, TabletButton, Badge, input parts, TextBlocks) and the owner of their axis value names; closed lib, entry @/lib/variantOverrides only (the composed value variantOverrides and the override type VariantOverridesOverride too)
use: always
change: counterpart → src/config/lib/variantOverrides.config.ts (`satisfies VariantOverridesOverride`)
rules:
using:
- vo_config_only: overrides are written only in src/config/lib/variantOverrides.config.ts, never by editing a part's class table
- vo_shape_not_color: colors change through palette tokens, not here (this is for shape: radius, shadow, border, size, text)
- vo_modifiers: an override that replaces a stateful class carries the same modifier (hover:, dark:, focus-visible:)
editing:
- vo_no_shelf: the lib never imports src/components (types too) | the shelf reads the lib, never the reverse
- vo_names_here: axis value names are defined only in types.ts | a part's class table `satisfies Record<Name, string>` and the part re-exports the name type as its prop type | never a second definition on the part's side
- vo_name_first: a new variant / size name is added to types.ts first, then to the part's table
- vo_contract: keys and axis value names are a public contract | removing or renaming one ships a notice
- vo_entry: every part with a cva table builds it with createOverridableVariants (or adds stateful axes with variantOverrideClasses)
read: how overrides work, what the lib owns → Overview | override file example → Usage | functions, types → API | override file, contract → Extension | merge order, adding a name → Internals
