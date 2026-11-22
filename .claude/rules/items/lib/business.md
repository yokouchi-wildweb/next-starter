---
paths:
  - "src/lib/business/**"
---
# lib/business
what: the project identity (service name, description, official URL, company, logo, mail sender, htmlLang, SEO defaults): its type, example values, the sample / own mark and the production check | readers use @/business (src/wiring/business.ts)
use: always
change: placement = src/business/business.ts (fork-owned folder, receptacle businessValues) | start it with `pnpm ops business from-example` or `blank`
rules:
using:
- read_business_entry: code reads `import { business } from "@/business"` only | scripts read it by `await import("@/business")`
- lib_takes_args: libs and utils never read @/business: they take the values as arguments | lib/mail, lib/metadata, lib/url get them through their own config override, which copies from @/business
- own_before_release: a production build with `source: "sample"` fails pnpm check business → `own` (every field required) before release
- legal_values_in_legal: values only the legal documents read (payment methods, document dates, licenses) go to src/config/domains/legal.config.ts, never here
- seo_from_identity: SEO site name, URL and description come from serviceNameShort, url, description (no separate keys) | viewport is the root frame's setting
editing:
- examples_upstream_only: a fork never edits examples/business.ts | an upstream change to it adds a line to examples/CHANGELOG.md
- shared_release_level: legal's release check uses the same sampleReleaseLevel (keep one judge)
read: where values live, how to read → Usage | the mark and init tools → Extension | resolveBusiness, sampleReleaseLevel → API | tests → Verification
