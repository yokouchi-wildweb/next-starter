# DOWNSTREAM NOTICE id:20261020-045144-journal-owner-rename-existing
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(change ships in the commit that contains this notice)
date: 2026-10-20T04:51:44Z
severity: action-required
checkpoint: journal-owner-rename-existing
moved: -
change: follow-up to 20261019-153000-journal-owner-naming. That notice left renaming the fork's existing journal records optional; this one makes it required so every tier's docs/journal/ holds only owner-named records. No upstream file changes besides this notice.
why: a fork with old-style names keeps mixing its own records with upstream ones (the old names carry no owner), so agents still cannot tell whose history a record is — the purpose of the naming rule is only met when existing records are renamed too.
required_actions:
1. Identify the fork's own records: every file in docs/journal/ except README.md that does not match `<YYYY-MM-DD>--<owner>--<slug>.md` (records with another repo's owner arrived by merge — leave them as they are).
2. Rename each with `git mv` to `<YYYY-MM-DD>--<own repo name>--<slug>.md` (own repo name = last segment of this fork's origin URL, lowercased; keep the original date and slug).
3. Add `> owner: <own repo name>` as the line right after the title of each renamed record (body otherwise unchanged).
4. Repoint links to the renamed files: `grep -rn "docs/journal/" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=.notices .` → update every hit that names an old filename (project.md `ref:` lines, READMEs, other journal records).
verify: `ls docs/journal` shows README.md plus only `--<owner>--` names; every own record has an `> owner:` line; the grep in step 4 returns no link to a missing journal file.
manual_steps: -
refs: docs/journal/README.md (naming rule), prior notice 20261019-153000-journal-owner-naming
notes: if the fork already renamed its records while applying 20261019-153000, this notice is a no-op (verify only).
