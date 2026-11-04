# DOWNSTREAM NOTICE id:20261103-175406-wiring-readme-receptacle-exception
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle5 | commit:- (this commit)
date: 2026-11-04T16:50:00+09:00
severity: info
checkpoint: wiring-readme-receptacle-exception
resolves: 20261103-175406-wiring-readme-receptacle-exception
change: src/wiring/README.md now states the two exceptions to "wiring どうしは import しない" that pnpm test:wiring already allows: a generated wiring/<name>.ts importing the items of its own receptacles (wiring/<name>/<dir>/…, dir declared in wiring/<name>/extensionPoints.ts) plus items of the same receptacle importing each other, and the form-input bundle (AppProviders.tsx → formInputs/FormInputsRoot.tsx, imports inside formInputs/). Docs only
why: the README stated the rule without its exceptions and so contradicted the receptacles shipped in src/wiring/dbAgent and src/wiring/formInputs
required_actions: none
verify: pnpm test:wiring passes
manual_steps: -
refs: src/wiring/README.md | src/wiring/wiring.test.mjs (isReceptacleImport, isFormInputsBundleImport) | order 20261103-175406-wiring-readme-receptacle-exception
notes: no code or check changed; receptacle items keep plain names without fork-name marks
