---
paths:
  - "src/components/Icons/**"
---
# components/Icons
what: project icons with the same API as Lucide icons (image or SVG), units @/components/Icons/createImageIcon, createSvgIcon, definitions (the icons) and types
use: always
change: none → /order <direct parent>
rules:
using:
- icon_asset_path: an image icon's path comes from iconPath() (@/utils/assets, files in public/assets/icons/), never a direct path string
editing:
- icon_define_place: a new icon is defined in definitions.ts with createImageIcon or createSvgIcon and used through @/components/Icons/definitions
read: use or add an icon → Usage | props per kind → API
