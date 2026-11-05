# DOWNSTREAM NOTICE id:20261105-115506-field-frame-helper-text
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-05T11:55:06+09:00
severity: action-required
checkpoint: field-frame-helper-text
resolves: 20261104-090257-field-frame-description
change: The field frame now draws `fieldConfig.helperText` as the field description (under the label, linked by aria-describedby) for ConfiguredField built-in inputs, registered form inputs with frame: true, and ConfiguredMediaField / ConfiguredMediaMultiField. Media fields no longer pass helperText into the uploader. `helperText` is the one name for a field's explanatory text (FieldConfig, domain.json fields, setting `ui.field`, profile fields); an explicit `description` prop still wins.
why: Behavior changes silently: (1) helperText on non-media fields was ignored before and is now shown; (2) on media fields the text moves from the center of the drop area to the frame's description slot under the input. Forks that drew a description inside their own registered input part to work around the gap now show it twice.
required_actions:
1. Find registered form input parts that draw their own explanatory text because the frame did not: `git grep -n "helperText\|description" -- 'src/features/*/components/**' 'src/wiring/formInputs/inputs/*'` and the parts named by your `src/wiring/formInputs/inputs/*.ts` items with frame not false. For each part that renders a fixed explanation (e.g. oripa-do src/features/inquiry/components/common/SupportAdminUserInput.tsx), move the text to the field's `helperText` (setting key `ui.field.helperText`, domain.json field `helperText`) and delete the in-part rendering.
2. Review fields that already set helperText on non-media inputs, since they now render: `git grep -n "helperText" -- 'src/features/**/domain.json' 'src/features/**/*.profile.json' 'src/features/**/fields/*.ts' 'src/features/**/*.override.ts'`. Keep the ones you want shown; remove the ones that were never meant to be visible.
3. If a fork-owned screen passed `description={...}` to ConfiguredField / ConfiguredMediaField only to show the same text as helperText, drop the prop (helperText is drawn by default).
verify: pnpm typecheck | pnpm test:form-inputs | open a form with a helperText field (setting screen or a generated admin form) and check the text appears once under the field, and on media fields under the drop area instead of inside it.
manual_steps: -
refs: src/components/Form/Field/Configured/fieldDescription.ts, src/components/Form/Field/Configured/ConfiguredField.tsx, src/components/Form/Field/Configured/ConfiguredMediaField.tsx, src/components/Form/Field/Configured/ConfiguredMediaMultiField.tsx, src/components/Form/README.md (設定駆動フィールドの使い分け), order 20261104-090257-field-frame-description
notes: Inputs without a frame (switchInput, stepperInput, registered inputs with frame: false) do not draw helperText. MediaInput / MediaUploader / ControlledMediaField keep their own `helperText` prop for direct use (unchanged). oripa-do not checked beyond the part named in the order.
