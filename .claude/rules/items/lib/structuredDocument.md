---
paths:
  - "src/lib/structuredDocument/**"
---
# lib/structuredDocument
what: structured documents by type (types: legal) as structure types + a renderer, and the one `{{key}}` substitution | entry @/lib/structuredDocument, /legal (LegalDocumentRenderer, LegalDocument), /shared (replaceVariables, listVariables)
use: always
change: none → /order <direct parent>
rules:
using:
- sd_one_substitution: `{{key}}` substitution uses replaceVariables / listVariables of shared/variables.ts only, never another replacer
- sd_legal_content: legal texts and their values live in src/features/core/legal | a screen passes getLegalDocument(kind) output (already substituted), without `variables`
editing:
- sd_types_render_only: the lib holds structure types and rendering only, never document content
- sd_type_shape: a document type = a subfolder with definition.ts, Renderer/, index.ts and README.md (legal/ is the model)
read: render a document → Usage | substitution → API | add a type → Internals | legal props, modes, numbering → src/lib/structuredDocument/legal/README.md API
