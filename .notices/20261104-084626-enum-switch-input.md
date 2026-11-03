# DOWNSTREAM NOTICE id:20261104-084626-enum-switch-input
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-04T08:46:26+09:00
severity: info
checkpoint: enum-switch-input
resolves: 20261103-170209-enum-switch-input-pair
change: the domain.json check accepts fieldType "enum" + formInput "switchInput" (Neon) when the enum has exactly 2 options (1st = on, 2nd = off, as inputResolver already renders it); an enum switchInput with 1 or 3+ options gets a new warning instead of "表に無い組"
why: a working setting (e.g. a 2-value status as a switch) was warned as an unknown pair; with options other than 2 the switch falls back to boolean values that the enum rejects on submit
required_actions: none
verify: `pnpm dc:generate:all --yes --dry-run` shows no "表に無い組" warning for a 2-option enum with switchInput; an enum switchInput with 1 or 3+ options shows "enum の formInput \"switchInput\" は options がちょうど 2 つのときだけ働きます"
manual_steps: -
refs: scripts/domain-config/spec/formInputs.mjs | scripts/domain-config/checks/fields.mjs | src/components/Form/Field/Configured/inputResolver.tsx | order 20261103-170209-enum-switch-input-pair
notes: warning only (generation is not stopped). The generator is unchanged: forms render from the domain config at runtime. oripa-do src/features/prizeItem/domain.json (state: active / inactive) now passes without warnings (checked)
