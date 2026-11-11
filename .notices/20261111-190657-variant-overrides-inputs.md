# DOWNSTREAM NOTICE id:20261111-190657-variant-overrides-inputs
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261026-152333-shared-shelf.3-shelf | commit:- (this commit)
date: 2026-11-11T19:06:57+09:00
severity: info
checkpoint: variant-overrides-inputs
change: src/config/ui/variants.config.ts (defineVariantOverrides) takes 9 new keys for shelf parts that had their own cva: booleanCheckbox { base, size }, booleanRadioGroup { base, size }, singleCardCheckbox { base, size, color }, stepperInput { base, size }, switchInput { track: { base, size, activeColor, inactiveColor }, indicator: { base, size } }, pageTitle / para / secTitle / span { base, tone, size, weight, align }. The classes are added after the part's default classes and before the caller's className (tailwind-merge, last wins). switchInput.track.activeColor applies only while on and inactiveColor only while off; singleCardCheckbox.color applies to the colour in use. The value names are types in @/lib/variantOverrides (CheckControlSize, SingleCardCheckboxColor, StepperInputSize, SwitchInputColor, TextTone, TextSize, TextWeight, TextAlign); createOverridableVariants now resolves every cva axis, variantOverrideClasses takes any axes. Props, default classes and the output with no override are unchanged.
why: Every shelf part with cva goes through the variantOverrides mouth (D112), so a fork changes these parts' look from its own config instead of editing core.
required_actions:
1. Nothing to do. [判断] A fork that restyled these parts by editing core files or copying them may move those classes into src/config/ui/variants.config.ts under the new keys (src/styles/README.md「バリアントの上書き」).
verify: pnpm typecheck | pnpm test src/lib/variantOverrides src/components/Form/Input/Manual/variantOverrides.test.tsx src/components/TextBlocks/variantOverrides.test.tsx
manual_steps: -
refs: src/lib/variantOverrides/types.ts, src/styles/README.md (バリアントの上書き), src/components/TextBlocks/README.md, legate order 14 of council 20261026-152333-shared-shelf
notes: Button / Badge / TabletButton keys, types and output are unchanged. Not on the mouth yet: Layout/* (spacing migration later), AppFrames/Admin/Elements/SecTitle. variants.config.ts is not edited upstream (the keys are optional; an existing fork file needs no change).
