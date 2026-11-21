---
paths:
  - "src/lib/plainObject/**"
---
# lib/plainObject
what: the one plain-object test isPlainObject (non-null object whose prototype is Object.prototype or null; arrays, Date, Map and class instances are not plain), shared by libs, domains, screens and Node tools; entry @/lib/plainObject/index.mjs
use: always
change: none → /order <direct parent>
rules:
using:
- plain_import: import `@/lib/plainObject/index.mjs` (TS does not resolve a folder's index.mjs) | Node tools read src/lib/plainObject/index.mjs by a relative path
- plain_no_copy: never write another isPlainObject | own-property checks use the built-in Object.hasOwn
editing:
- plain_pure: pure functions only, no Node built-ins, no other lib
- plain_mjs: it stays .mjs so Node tools without tsx read the same file
read: function, import → API
