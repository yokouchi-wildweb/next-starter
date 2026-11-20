---
paths:
  - "src/lib/folderCatalog/**"
---
# lib/folderCatalog
what: reads, checks and resolves ownership of a folder catalog (CATALOG.md: which repo made each directory under a folder, or each shelf unit src/components/\<Category\>/\<Unit\>); entry catalog.mjs (parseCatalog, checkCatalog, listDirs, listUnits, loadCatalogOwnership)
use: always
change: placement = src/lib/CATALOG.md and src/components/CATALOG.md (each repo appends its own section; catalogSections / componentsCatalogSections in extensionPoints.ts)
rules:
using:
- owner_from_repo_json: the owner id comes from repo.json repo_id through readForkIdentity, never from the origin URL
editing:
- node_builtins_only: catalog.mjs runs on Node built-ins only (eslint.config.mjs runs it at load time)
- folder_agnostic: the functions take the folder as an argument, never hard-code src/lib
read: call it → API | tests → Verification | catalog format → Related
