---
paths:
  - "src/components/Form/**"
---
# components/Form
what: form parts (@/components/Form/*): AppForm, Field, Input/Controlled (react-hook-form inputs over components/Input), FieldRenderer, AutoSave, Button | the plain inputs, Label and FilePickButton → components/Input (its card)
use: always
change: none → /order <direct parent>
rules:
using:
- submit_lock: AppForm drops a second submit → no own lock
- submit_failure: failed submit = onSubmit throws | the thrower toasts, not AppForm
- media_commit: media field outside AppForm → commit() yourself
- media_purpose: media field in a hand-written form → register a purpose, pass `purpose`
- group_notice: section notice → beforeGroup / afterGroup, not beforeField on its first field
- default_values: defaults match the schema type (`""` to array / object fails) | required jsonb + formInput none → defaultValue
- autosave_values: AutoSave onSave gets pre-Zod values → a hand-written one converts them
- shaped_press: press area shaped by className → Button variant="none" size="none"
editing:
- helper_text: the field frame draws the description, not the input part
- field_types: a type added to the type table → add it to the union in Field/types.ts
read: which style → Overview | examples → Usage | props, sizes → API | own inputs, tokens → Extension | submit, media → Internals | auto save → src/components/Form/AutoSave/README.md Usage | FieldRenderer → src/components/Form/FieldRenderer/README.md API
