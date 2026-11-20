---
paths:
  - "src/lib/folderCatalog/**"
---
# lib/folderCatalog
what: reads, checks and resolves ownership of a folder catalog (CATALOG.md: which repo made each directory under a folder, each shelf unit src/components/\<Category\>/\<Unit\>, or each file unit of src/hooks / src/utils); entry catalog.mjs (parseCatalog, checkCatalog, listDirs, listUnits, listFileUnits, loadCatalogOwnership)
use: always
change: placement = src/lib/CATALOG.md, src/components/CATALOG.md, src/hooks/CATALOG.md and src/utils/CATALOG.md (each repo appends its own section; catalogSections / componentsCatalogSections / hooksCatalogSections / utilsCatalogSections in extensionPoints.ts)
rules:
using:
- owner_from_repo_json: the owner id comes from repo.json repo_id through readForkIdentity, never from the origin URL
editing:
- node_builtins_only: catalog.mjs runs on Node built-ins only (eslint.config.mjs runs it at load time)
- folder_agnostic: the functions take the folder as an argument, never hard-code src/lib
read: call it → API | tests → Verification | catalog format → Related
