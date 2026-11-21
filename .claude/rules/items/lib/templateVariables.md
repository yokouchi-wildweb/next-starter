---
paths:
  - "src/lib/templateVariables/**"
---
# lib/templateVariables
what: the one `{{key}}` substitution for text (replaceVariables, listVariables, replaceVariablesInArray, VariableMap) | closed lib, entry "." @/lib/templateVariables only, no dependencies, pure functions
use: always
change: none → /order <direct parent>
rules:
using:
- tv_one_substitution: `{{key}}` substitution uses this lib only (structured documents, messaging, legal values), never another replacer
editing:
- tv_pure: the lib stays dependency-free pure functions (no React, no shelf, no other lib)
- tv_key_shape: a key = letters of any script, digits and _ | a change of the key shape changes every reader (messaging embedded names follow it)
read: usage → Usage | functions, key shape → API
