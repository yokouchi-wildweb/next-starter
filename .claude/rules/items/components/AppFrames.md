---
paths:
  - "src/components/AppFrames/**"
---
# components/AppFrames
what: shared frame parts with no permanent home yet: none left (KioskFrame moved to components/Layout, admin screen parts to components/Admin) | User/ holds no parts (moved to src/app/(user)/_layout/)
use: always
change: none → /order <direct parent>
rules:
using: none of its own (the folder holds no parts)
editing:
- frame_parts_place: new layout frame parts go to src/app/<route>/_layout/, never here
read: old Hide* parts → src/components/AppFrames/User/README.md Usage
