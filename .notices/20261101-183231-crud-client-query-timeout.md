# DOWNSTREAM NOTICE id:20261101-183231-crud-client-query-timeout
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle2-crud-db | commit:(this commit)
date: 2026-11-01T18:32:31+09:00
severity: action-required
checkpoint: crud-client-query-timeout
resolves: 20261101-133024-fix-crud-where-api-client
change: CRUD client search now really sends orderBy (JSON) and searchFields (comma separated), normal operations carry a 60 s timeout, and WhereExpr value is optional for isNull / isNotNull
why: both params were serialized with brackets and dropped by the route, so forks passing them got the service defaults; they now apply and can change results
required_actions:
1. Find client sorts: git grep -nE "orderBy" -- 'src/features/*/hooks' 'src/features/*/components' 'src/app/**/_components' ':!src/features/core'. Each one now sorts for real: confirm the field exists on the table (an unknown field is expected to fail the query) and the direction is upper case "ASC" or "DESC" ("asc" is read as DESC). Fix the caller where needed.
2. Find narrowed searches: git grep -n "searchFields" -- 'src/features/*/components' 'src/features/*/hooks' 'src/app/**/_components' ':!src/features/core'. Each list now replaces the service default. Unknown columns are ignored, and a list with only unknown columns returns no rows. Correct or remove the list where the default was the intended behaviour.
3. Check operations that may run over 60 s through createApiClient (getAll, getById, create, update, delete, search, upsert, restore, hardDelete, reorder, searchForSorting, count). bulk*, replaceByQuery and duplicate have no timeout. Move a slow one to a route and client of its own.
4. oripa-do only: git checkout the upstream version of src/lib/crud/client/apiClientFactory.ts, remove its line from .fork-ownership/oripa-do.permits.txt. This also removes its global axios.defaults.timeout of 30 s: every other axios call in oripa-do goes back to no timeout, set one per client if still wanted.
verify: pnpm typecheck && pnpm test:crud-client
manual_steps: -
refs: src/lib/crud/client/apiClientFactory.ts, src/lib/crud/types.ts, src/app/api/[domain]/search/utils.ts
notes: axios.defaults is untouched. A timed-out mutation may still finish on the server while the UI shows an error. The Firestore reader is unchanged (adapter frozen): isNull / isNotNull are still not applied on Firestore domains, as before. Forks that build a where object with op typed as a wider custom string may need a cast.
