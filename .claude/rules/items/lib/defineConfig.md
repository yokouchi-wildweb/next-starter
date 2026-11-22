---
paths:
  - "src/lib/defineConfig/**"
---
# lib/defineConfig
what: the shared composer of lib configs: defaults + rules, then the config values → a deep-merged, validated config | entry @/lib/defineConfig (defineConfig, OverrideOf, WithExtra)
use: always
change: none → /order <direct parent>
rules:
using:
- defaults_typed: annotate `defaults` with the lib's config type (it is the source of inference)
- override_type_exported: a lib exports its `XxxOverride<E>` (= OverrideOf<typeof def, E>) from its entry as a type only
- schema_checks_only: `rules.schema` (Standard Schema, sync only) only checks the composed value; its output is never used (zod would drop fork keys)
- null_deletes_optional: `null` deletes only a key typed optional (`?:`) | `undefined` keeps it
- by_items_have_id: every item of a `{ by }` array carries its id | `$delete` only an id that exists
- extra_widens: a fork's Extra may add keys or widen a default's type, never change it (a changing type becomes never) | a key in Extra keeps its own optionality (one without ? must be written in the config values file)
- annotate_with_extra: type a composed value as `WithExtra<XxxConfig, Extra>`, never `XxxConfig & Extra` (arrays become intersections)
editing:
- no_lib_deps: the lib depends on no other lib (package.json `libs` stays empty) and never imports zod
read: write a lib's config.ts → Usage | merge and array rules, types → API | Extra → Extension | tests → Verification
