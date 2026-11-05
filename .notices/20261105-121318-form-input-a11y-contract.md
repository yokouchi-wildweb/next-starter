# DOWNSTREAM NOTICE id:20261105-121318-form-input-a11y-contract
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-05T12:13:18+09:00
severity: info
checkpoint: form-input-a11y-contract
resolves: 20261104-142141-async-combobox-label-link
change: Every Form/Input unit now accepts `id`, `aria-describedby`, `aria-invalid` (new type FormControlA11yProps in @/components/Form/Field, also used by FormInputProps) and puts them on its focusable element: SelectInput, ComboboxInput, MultiSelectInput, AsyncComboboxInput, AsyncMultiSelectInput (trigger button, was the wrapper div or dropped), SingleCardCheckbox (checkbox), StepperInput (manual input; role="group" wrapper when manualInputEnabled is false), ColorValueInput (role="group" wrapper); Controlled ColorInput / ColorValueInput now forward them. UserAsyncCombobox / UserAsyncMultiSelect pass them through. New test pnpm test:form-a11y-contract walks every Input/Manual export and every builtin formInput.
why: Registered form input parts receive these three props from the field frame; passing them to the picker now links the label, description and error to it. Optional props only, existing callers are unchanged.
required_actions: none
verify: pnpm typecheck | pnpm test:form-a11y-contract | pnpm test:form-inputs
manual_steps: -
refs: src/components/Form/Input/a11yContract.test.tsx, src/components/Form/Field/types.ts (FormControlA11yProps), src/components/Form/README.md (入力部品の約束), src/wiring/formInputs/inputs/README.md, order 20261104-142141-async-combobox-label-link
notes: Optional follow-up: registered parts that wrap a picker (e.g. oripa-do SimulatorUserInput, SupportAdminUserInput) can now pass `{ id, "aria-describedby": ..., "aria-invalid": ... }` from FormInputProps straight to UserAsyncCombobox. A fork screen that passed `id` to ComboboxInput / MultiSelectInput / Async* now gets it on the trigger button instead of the wrapper div (CSS targeting that id should use [data-slot] or a className). Fork-added input units are not covered by the test table; add them to your own test if you want the same check. Out of scope: radio / checkGroup keep the id on the group wrapper (label[for] does not focus a group; aria-labelledby is a separate change).
