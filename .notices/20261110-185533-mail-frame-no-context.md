# DOWNSTREAM NOTICE id:20261110-185533-mail-frame-no-context
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-10T18:55:33+09:00
severity: info
checkpoint: mail-frame-no-context
fixes: commit:d78665c50
change: src/lib/mail/frame no longer uses React context (createContext / useContext): the theme is a required prop on MailFrame and on every part, and createMailParts(theme) returns parts bound to one theme | MailThemeProvider and useMailTheme are removed (added in d78665c50, unused anywhere) | scripts/structure/registry/gate.json watch covers scripts/structure/extensions/derive/messageGuards.mjs (the registry check imports it)
why: since d78665c50, @/lib/mail pulled createContext into the server module graph (admin pages → user service → registration mail → @/lib/mail), so pnpm build failed at every checkpoint after it (config-tier1-close, config-fork-placement, purchase-bonus-display). Taking this notice makes the build pass again
required_actions: none
verify: pnpm build passes | pnpm test src/lib/mail passes
manual_steps: -
refs: src/lib/mail/README.md「メールの枠の部品」, src/lib/mail/frame/createMailParts.tsx, council 20261108-120538-system-messaging-templates legate:l2 order:09 AMENDMENT 1
notes: no fork code uses the mail frame parts yet; if a fork already wrote <MailFrame theme={…}> with parts inside, pass theme={…} to each part or build them with createMailParts(theme)
