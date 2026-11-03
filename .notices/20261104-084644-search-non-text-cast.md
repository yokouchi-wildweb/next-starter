# DOWNSTREAM NOTICE id:20261104-084644-search-non-text-cast
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-04T08:46:44+09:00
severity: info
checkpoint: search-non-text-cast
resolves: 20261103-140459-search-where-non-text-columns
change: keyword search (buildSearchWhere in src/lib/crud/drizzle/query/buildSearchRank.ts) casts non-text searchFields columns (enum, uuid, numeric, custom; relation FK columns too) to ::text before ILIKE; text / varchar / char columns are compared as before (same SQL, same index use). The domain.json check no longer warns "searchFields ... は文字列の列ではありません" for Neon domains (Firestore keeps the warning)
why: a non-text column in searchFields made Postgres reject a keyword search with "operator does not exist"; the ranking half (buildSearchRankOrderBy) already cast every column, so the two halves of one search disagreed. Behaviour changes silently: such searches now return rows instead of failing
required_actions: none
verify: `pnpm test:crud-search-rank` passes; `pnpm typecheck` passes
manual_steps: -
refs: src/lib/crud/drizzle/query/buildSearchRank.ts | src/lib/crud/drizzle/query/searchRank.test.mjs | scripts/domain-config/checks/viewConfig.mjs | src/lib/crud/README.md (テキスト検索) | order 20261103-140459-search-where-non-text-columns
notes: the public buildSearchWhere keeps its signature; wrappers that call it get the cast as well. Columns a fork removed from searchFields only to avoid this error (oripa-do: analyticsExclusion, gachaPlaySession, gachaRankingSynthetic) may be put back if keyword search on them is wanted. A cast column's substring match does not use an index (an enum / uuid search was a full scan anyway)
