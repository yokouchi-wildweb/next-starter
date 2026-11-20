---
paths:
  - "src/components/AppFrames/**"
---
# components/AppFrames
what: shared frame parts with no permanent home yet: the admin list parts Admin/Elements | User/ holds no parts (moved to src/app/(user)/_layout/)
use: always
change: none → /order <direct parent>
rules:
using:
editing:
- frame_parts_place: new layout frame parts go to src/app/<route>/_layout/, never here
read: old Hide* parts → src/components/AppFrames/User/README.md Usage
