---
paths:
  - "src/components/Icons/**"
---
# components/Icons
what: project icons with the same API as Lucide icons (image or SVG), units @/components/Icons/createImageIcon, createSvgIcon, definitions (the icons) and types
use: always
change: add = a fork's own icon unit file directly under src/components/Icons/ (icon_define_place) | else → /order <direct parent>
rules:
using:
- icon_asset_path: an image icon's path comes from iconPath() (@/utils/assets, files in public/assets/icons/), never a direct path string
editing:
- icon_define_place: upstream defines a new icon in definitions.ts (createImageIcon / createSvgIcon), used through @/components/Icons/definitions | a fork defines its own icons in its own unit file directly under src/components/Icons/ (a line in its section of src/components/CATALOG.md), never in definitions.ts
read: use or add an icon → Usage | props per kind → API
