---
paths:
  - "src/lib/formSuite/**"
  - "src/**/plugs/formInputs/**"
---
# lib/formSuite
what: the form assembly (closed lib, entry @/lib/formSuite only): AppForm, the field frames Field (Manual / Controlled / Configured), the react-hook-form inputs ControlledTextInput … (over the shelf's @/components/Input units), FieldRenderer, AutoSave, FormActions, FormInputsProvider
use: always
change: add → own input parts registered in \<your domain or lib\>/plugs/formInputs/\<name\>.ts (formInput: "\<name\>") | none else → /order <direct parent>
rules:
using:
- fs_entry: read only @/lib/formSuite (no inner path) | plain inputs, Label, options types (FormControlA11yProps) come from the shelf @/components/Input/\<Unit\>, never from here
- submit_lock: AppForm drops a second submit → no own lock
- submit_failure: failed submit = onSubmit throws | the thrower toasts, not AppForm
- media_commit: media field outside AppForm → commit() yourself
- media_purpose: media field in a hand-written form → register a purpose, pass `purpose`
- group_notice: section notice → beforeGroup / afterGroup, not beforeField on its first field
- default_values: defaults match the schema type (`""` to array / object fails) | required jsonb + formInput none → defaultValue
- autosave_values: AutoSave onSave gets pre-Zod values → a hand-written one converts them
editing:
- fs_direction: the shelf (src/components) never reads this lib | this lib reads the shelf (peers components) and the libs in its package.json, never src/domains (tests too: a test that needs a domain lives in that domain and reads the entry)
- fs_no_client_entry: index.ts never starts with "use client" | the mark stays on the files that need it
- fs_controlled_names: a Controlled input is exported as Controlled + the shelf unit's name (ControlledTextInput) | its props type ControlledXxxProps
- helper_text: the field frame draws the description, not the input part
- fs_field_config: FieldConfig = DomainField (@/lib/domain) widened with screen-only keys (purpose, onMetadataChange, async*) and narrowed formInput / options / mediaTypePreset / validationRule | a new entity.json field key goes to DomainField, never here
- field_types: fieldType / formInput names come from @/lib/domain (fieldTypeNames.ts, derived from the tables) | never a name list in this lib
- fs_relation_options: useRelationOptions decides nothing itself | which relations, prefetch and SWR keys stay in @/lib/domain relationOptions.mjs
- input_a11y_row: a new shelf input or builtin formInput gets a row in a11yContract.test.tsx (UNITS / BUILTIN, or the skip / NOT_INPUTS reason)
read: which style → Overview | examples → Usage | props, FieldConfig keys, useRelationOptions → API | own inputs, heights → Extension | submit, media, a11y → Internals | auto save → src/lib/formSuite/AutoSave/README.md Usage | FieldRenderer → src/lib/formSuite/FieldRenderer/README.md API
