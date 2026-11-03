# DOWNSTREAM NOTICE id:20261103-161212-domain-json-comment-key
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-03T16:12:12+09:00
severity: info
checkpoint: domain-json-comment-key
change: domain.json accepts the developer-note key "$comment" (string or string[]) at top level, relations[], fields[], fields[].collection and fieldGroups[]; the vocabulary check now groups unknown keys into one line per key (count + first 3 locations) listed after all other warnings, and also checks fieldGroups[] keys
why: JSON has no comments; a fork that writes notes under an unknown key (e.g. "description") got one warning per field. "$comment" is ignored by the generator (generated output is byte-identical) and never copied to entities/display.ts
required_actions: none
verify: pnpm test:dc-vocabulary passes | optional rename done → `git grep -n '"description"' -- 'src/features/**/domain.json'` lists nothing and `pnpm dc:generate <Domain>` prints no "知らないキー" line for it
manual_steps: -
refs: scripts/domain-config/spec/domainJson.mjs (COMMENT_KEY, FIELD_GROUP_KEYS) | scripts/domain-config/checks/vocabulary.mjs | src/features/README.md (section 開発者のメモ) | order 20261103-150338-domain-json-comment-key
notes: Optional (forks work without doing anything): rename a note key your fork used to "$comment". For "description" (not a known domain.json key at any level, so every occurrence is a note): `git grep -l '"description"' -- 'src/features/**/domain.json' | xargs sed -i 's/"description":/"$comment":/g'`, then `pnpm test:dc-vocabulary` and `pnpm dc:generate <Domain>` (output unchanged). fieldGroups[] keys are now checked: a misspelled key there (e.g. "colapsible") shows up as a new "知らないキー" warning; warnings never stop generation. Screen help text stays in helperText; "$comment" is never displayed.
