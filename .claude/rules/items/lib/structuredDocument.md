---
paths:
  - "src/lib/structuredDocument/**"
---
# lib/structuredDocument
what: structured documents by type (types: legal) as structure types + a renderer | closed lib: one entry @/lib/structuredDocument (LegalDocumentRenderer, LegalDocument …), shelf @/components as peers | the `{{key}}` substitution is lib templateVariables
use: always
change: none → /order <direct parent>
rules:
using:
- sd_one_substitution: `{{key}}` substitution uses @/lib/templateVariables only, never another replacer
- sd_legal_content: legal texts and their values live in src/features/core/legal | a screen passes getLegalDocument(kind) output (already substituted), without `variables`
editing:
- sd_types_render_only: the lib holds structure types and rendering only, never document content
- sd_type_shape: a document type = a subfolder with definition.ts, Renderer/, index.ts and README.md (legal/ is the model), its names re-exported from the root index.ts (the only entry)
read: render a document → Usage | substitution → src/lib/templateVariables/README.md API | add a type → Internals | legal props, modes, numbering → src/lib/structuredDocument/legal/README.md API
