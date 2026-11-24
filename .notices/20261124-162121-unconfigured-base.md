# DOWNSTREAM NOTICE id:20261124-162121-unconfigured-base
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:g2/20261124-161115/junction | commit:- (this commit)
date: 2026-11-24T16:21:21+09:00
severity: info
checkpoint: unconfigured-base
change: (1) new BackendNotConfiguredError + isBackendNotConfiguredError (@/lib/errors): the common parent of every "backend env not configured" error, extends Error (not DomainError), fields port / implementation? / missing (env names only) / side "client"|"server"; (2) DatabaseNotConfiguredError (port "database"), FirebaseNotConfiguredError (port "firebase", side as before), StorageNotConfiguredError (port "storage", implementation = store) and WebhookNotConfiguredError (port "mail", implementation = provider, missing = its webhook key env name) now extend it; their names, messages, constructors, own fields and throw sites are unchanged; (3) lib drizzle declares errors in its package.json libs and tsconfig paths (closed-lib closure)
why: one parent lets later work (the backend kit, the HTTP code mapping of a later segment) detect any unconfigured backend in one place; no behaviour change for forks
required_actions: none
verify: -
manual_steps: -
refs: src/lib/errors/README.md; .claude/rules/items/lib/errors.md; .claude/rules/core/backends.md unconfigured (base line); src/lib/drizzle/README.md; src/lib/firebase/README.md; .claude/rules/items/lib/drizzle.md; .claude/rules/items/lib/firebase.md
notes: key table: no key of CLAUDE.md / core / cards renamed or removed (core/backends.md unconfigured gains a sub-line `base:`, items/lib/errors.md gains a using rule backend_not_configured) | a fork's own NotConfiguredError may extend the base (optional, nothing asked) | instanceof sites of the 4 classes still match (they test the subclass)
