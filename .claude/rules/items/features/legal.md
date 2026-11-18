---
paths:
  - "src/features/core/legal/**"
  - "src/config/features/legal.config.ts"
---
# features/legal
what: the legal documents (terms, privacy policy, tradelaw notice) with no table: example texts, a per-document mark (sample / own), the filled-in document and the production check | entry @/features/legal/documents (getLegalDocument, getLegalEnactedAtFormat, buildLegalDocument)
use: always | the pages are closed by the rules pageTerms, pagePrivacyPolicy, pageTradelaw
change: placement = src/config/features/legal.config.ts (`documents.<kind>`, paymentMethods, licenses, enactedAtFormat) | own text = `pnpm ops legal from-example [kind …]` then edit the copy
rules:
using:
- own_before_release: a production build with any document still `source: "sample"` fails pnpm check legal → every document is `own` before release
- own_whole_document: an `own` entry carries its whole `document` (title, sections, enactedAt / lastUpdatedAt in the text)
- read_through_entry: readers use @/features/legal/documents, never LEGAL_CONFIG directly (only the gate rules read `pages` from @/features/legal/config)
editing:
- examples_upstream_only: a fork never edits examples/<kind>.ts | an upstream change to them adds a line to examples/CHANGELOG.md and ships a notice; a fork takes it in by editing its own text
read: pick sample / own, other keys → Extension | filling and readers → API | tests → Verification
