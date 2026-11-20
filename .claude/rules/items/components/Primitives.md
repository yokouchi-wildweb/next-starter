---
paths:
  - "src/components/Primitives/**"
---
# components/Primitives
what: the low-level parts of the shelf (raw parts that bind outside behavior such as Radix; placement → core/components.md primitives_place), one folder per part (Badge, Button, Calendar, Carousel, Checkbox, Command, Dialog, HoverCard, Input, Label, Popover, RadioGroup, Select, Skeleton, Slot, Tabs, Tooltip), entry @/components/Primitives/<Part> (no Primitives/index.ts)
use: always
change: placement → a fork restyles a part with its own CSS on the part's `[data-slot="<name>"]` marks (root src/styles/*.css)
rules:
using:
- primitives_entry: import a part only from its entry @/components/Primitives/<Part>, never a file inside it
- radix_unified: Radix comes from the unified `radix-ui` package only, never `@radix-ui/*` (lint radix-unified)
- finished_first: screens use the finished parts (Form/, Overlays/, Badge/, Skeleton/ …) | build on a primitive directly only when the finished part falls short
- slot_contract: fork CSS targets only the marks listed in each part's README | id, class names and DOM shape are not a contract
- slot_caller: a caller's `data-slot` prop never replaces the part's mark | a wrapping upstream part renames it only through the typed `slot` value
editing:
- slot_owner: a mark belongs to the part: put it after the caller's props spread so the caller cannot override it
- slot_list: the README list `### data-slot の一覧` = the marks in the part's files (checked by src/components/Primitives/slots.test.mjs, /ship runs it)
- slot_notice: removing or renaming a mark → notice
read: every part folder has a README with the same h2 set (Button shown) | what a part is, its finished part → src/components/Primitives/Button/README.md Overview | props → src/components/Primitives/Button/README.md API | marks for fork CSS → src/components/Primitives/Button/README.md Extension | list check → src/components/Primitives/Button/README.md Verification
