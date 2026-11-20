---
paths:
  - "src/components/Input/**"
---
# components/Input
what: plain input parts (value + onChange, no react-hook-form): text / number / date / select / combobox / multi-select / async pickers / radio / checkbox / switch / stepper / color / file, Label, FilePickButton, the async engine AsyncOptionSource and the option helper options, entries @/components/Input/<Unit> (no index.ts)
use: always
change: none → /order <direct parent>
rules:
using:
- form_binding: react-hook-form binding and the field frame (label, description, error) come from Form (Field, Controlled, FieldRenderer), never wired by hand around these parts
- options_disabled: Options.disabled = display only → validate in the ServerService
- password_autocomplete: PasswordInput always takes autoComplete
- toggle_label: unlabeled switch / checkbox → aria-label
- control_size: controls in a row take the same size, no height overrides | HTML size → htmlSize | inner buttons → INNER_BUTTON_CLASSES
- file_pick: button-shaped file picker → FilePickButton, not label + buttonVariants
- async_engine: a new async picker uses AsyncOptionSource (useAsyncOptionSource + AsyncOptionList), never its own paging
editing:
- no_rhf: nothing here imports react-hook-form (its types stay in Form)
- input_a11y: input parts set id, aria-describedby, aria-invalid on the focus element (groups: the group box) + a row in a11yContract.test.tsx (UNITS, or NOT_INPUTS with a reason)
- helper_text: the field frame draws the description, not the input part
- control_height: heights = --control-h-<size> tokens, no numeric h-*
- unit_entry: one unit never reads a file inside another folder unit → export it from that unit's entry
read: pick a part → Overview | options disabled, async pickers, FilePickButton → Usage | options helper, sizes → API | a11y contract, async engine → Internals
