---
paths:
  - "src/lib/stringCase/**"
---
# lib/stringCase
what: name case conversion (toCamelCase, toPascalCase, toKebabCase, toSnakeCase), shared by the domain generators, libs and screens; entry @/lib/stringCase/index.mjs
use: always
change: none → /order <direct parent>
rules:
using:
- case_import: import `@/lib/stringCase/index.mjs` (TS does not resolve a folder's index.mjs) | Node tools read src/lib/stringCase/index.mjs by a relative path
editing:
- case_pure: pure functions only, no Node built-ins, no other lib
- case_mjs: it stays .mjs so Node tools without tsx read the same file
read: functions, import → API
