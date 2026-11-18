# forkOwnership API

## Overview

- forkOwnership の部品の関数の形。使い方と決まりの置き場は [README.md](./README.md)、仕組みは [Internals.md](./Internals.md)

## API

### 受け口の一覧(`intake.mjs`)

- `parseIntake(text)` → `{ rules, errors }`
- `matchIntake(rules, path)` → 効く規則か `null`
- `replaceIntakeBlock(text, rows)` → 生成区画を入れ替えたテキスト

### 判定の核(`judge.mjs`)

- `judge({ changes, baseText, headText, baseLibs, baseHasCore, baseHasGate, intake, places, baseUnits })` → `{ entries: [{ status, path, from, kind, reason, verdict, clash }], counts }`
  - `places` = `unitPlaces(基準のファイル, 基準の中身)`、`baseUnits` = `unitIndex(基準のファイル)`。渡さなければ単位名の検査をしない
  - `clash` = unit-clash の相手の基準のパス
  - reason ごとの合否は `REASONS`
- `forkAddedFiles(repoRoot, { parent, branch, fetch })`: fork が足したファイルの一覧だけが要る検査(featureGate の規則の重なりなど)の口。Tier1 は git に触れず空、基準が求められなければ `unverified`(合格にしない)

### 一時許可(`permits.mjs`)

- `parsePermits(text)` → `{ permits, errors }`
- `blobId(text)` / `fingerprint(text, kind)`
- `checkPermits({ entries, permits, baseText, headText, intake, resolvedUpreqs })` → `{ entries(permit・verdict 付き), leftovers }`
- `permitsPath(forkId)`
- 依頼の番号の形: `UPREQ_ID`

### 区画(`regions.mjs`、Node 組み込みだけの `.mjs`)

- `parseForkRegions(text)` → `{ regions: [{ start, end, legacy }], errors: [{ line, message }] }`(行は 1 始まり、start / end は印の行)
- `isInForkRegion(regions, line)`: その行が区画の中(印の行を除く)か
- `FORK_REGION_START` / `FORK_REGION_END` / `LEGACY_FORK_MARKERS`
- 生成器の区画: `parseGeneratorRegions(text)` / `stripOwnedRegions(text, { fork })`

### 基準の版のファイル(`baseFiles.mjs`)

- `readBaseFiles` / `lastUpstreamSha`: notice の隣の codemod `.notices/<id>.<名前>.mjs` が読む公開の入口

### リポの名前と段(`forkIds.mjs`)

- `readForkIdentity(repoRoot)` → `{ own, ancestors, isTier1, tier, downstream, downstreamError, errors }`
- `readDeclaredForkIds(repoRoot)` → `{ own, inherited, all, errors }`
- `parseRepoJson(text)` / `parseRepoIdentity(text)` / `formatRepoJson(values)`
- `forkIdOfTexts({ repoJson, projectMd })`: 過去の版を読む所(repo.json を先に、無ければ古い形)
- 古い形: `parseForkIdDeclaration(text)` / `parseDownstreamDeclaration(text)`

### 中間層の規則(`lineage.mjs`)

- `checkLineageStructure` / `checkOverrides` / `touchedOverrides` / `formatProblems`(中身は Internals.md「中間層の規則」)

### 検査の本体(`check.mjs`)

- `runCheck`: `pnpm workflow ownership check` の手順(Internals.md「検査の手順」)。`lineage` 欄 = `{ checked, failures, warnings }`
- `resolveForkContext` / `judgeFork`: `pnpm workflow ownership who` も使う前提と判定
