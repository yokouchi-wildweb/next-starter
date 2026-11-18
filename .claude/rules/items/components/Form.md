---
paths:
  - "src/components/Form/**"
---
# components/Form
what: form parts (@/components/Form/*): AppForm, Field, Input, FieldRenderer, AutoSave, Button, FilePickButton
use: always
change: none → /order <direct parent>
rules:
using:
- submit_lock: AppForm drops a second submit itself → no own lock
- submit_failure: failed submit = onSubmit throws | the thrower toasts, not AppForm
- media_commit: media field outside AppForm → commit() yourself
- media_purpose: media field in a hand-written form → register a purpose, pass `purpose`
- options_disabled: Options.disabled = display only → the server rejects them
- group_notice: section notice → beforeGroup / afterGroup, not beforeField on its first field
- default_values: defaults match the schema type (`""` to array / object fails) | required jsonb + formInput none → defaultValue
- autosave_values: AutoSave onSave gets pre-Zod values → a hand-written one converts them
- password_autocomplete: PasswordInput always takes autoComplete
- toggle_label: unlabeled switch / checkbox → aria-label
- control_size: controls in a row take the same size, no height overrides | HTML size → htmlSize | inner buttons → INNER_BUTTON_CLASSES
- file_pick: button-shaped file picker → FilePickButton, not label + buttonVariants
- shaped_press: press area shaped by className → Button variant="none" size="none"
editing:
- input_a11y: input parts set id, aria-describedby, aria-invalid on the focus element (groups: the group box) + a row in Input/a11yContract.test.tsx
- helper_text: the field frame draws the description, not the input part
- control_height: heights = --control-h-<size> tokens, no numeric h-*
- field_types: a type added to the type table → add it to the union in Field/types.ts
read: which style → Overview | examples → Usage | props, sizes → API | own inputs, tokens → Extension | submit, media → Internals | auto save → src/components/Form/AutoSave/README.md Usage | FieldRenderer → src/components/Form/FieldRenderer/README.md API
