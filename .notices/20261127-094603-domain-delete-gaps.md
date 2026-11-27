# DOWNSTREAM NOTICE id:20261127-094603-domain-delete-gaps
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:ec433abdd
date: 2026-11-27T09:46:03+09:00
severity: info
checkpoint: domain-delete-gaps
change: `pnpm generate domain -- --delete`: the stop on a feature-gate rule listing the domain now applies only with `--remove-config` (a delete that keeps the declaration leaves a domain the rule may still list). The domain's config values files `src/config/domains/<folder>.config.ts` and `<folder>.<name>.config.ts` are deleted with the domain and no longer count as a remaining import. scripts/structure/domain/README.md now says what the delete really does with the registries: serviceRegistry is rebuilt, the other src/registry lists by `pnpm generate registry`
why: the delete tool and its README disagreed in three places (research tooling.ns-cluster5-after-shelf Q1 6-8, D491); a domain with a config values file could not be deleted at all (that file imports the owner's types)
required_actions: none
verify: -
manual_steps: -
refs: scripts/structure/domain/cli/delete.mjs, scripts/structure/domain/pipeline/remove/index.mjs (configValuesFilesOf), scripts/structure/domain/README.md (--delete)
notes: Known gap, written in the README: after a delete that keeps the declaration, serviceRegistry cannot be rebuilt (the kept entity.json points at the deleted service) until the domain is generated again or deleted with --remove-config. Fork-specific impact: not checked.
