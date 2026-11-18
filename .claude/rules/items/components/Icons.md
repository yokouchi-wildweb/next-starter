---
paths:
  - "src/components/Icons/**"
---
# components/Icons
what: project icons with the same API as Lucide icons (image or SVG), entry @/components/Icons (createImageIcon, createSvgIcon, the icons of definitions.ts)
use: always
change: none → /order <direct parent>
rules:
using:
- icon_asset_path: an image icon's path comes from iconPath() (@/utils/assets, files in public/assets/icons/), never a direct path string
- icon_image_props: an image icon takes size / className only (color / strokeWidth have no effect)
editing:
- icon_define_place: a new icon is defined in definitions.ts with createImageIcon or createSvgIcon and used through @/components/Icons
read: use or add an icon → Usage | props per kind → API
