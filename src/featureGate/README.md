# featureGate

機能を閉じる仕組み(門番)の置き場。src 直下の専用の基盤(lib にも core のドメインにも置かない)。
この README は仮の 1 枚です(本文は文書の区切りで書き直す)。

## 置き場

- `rules/<名前>.ts` … 機能を閉じる規則(1 機能 1 ファイル、`export const rule`)。名前 = ファイル名 = `FeatureName`
- `alwaysOnExceptions/<名前>.ts` … 常時実行の入口の例外(`export const exception` か `export const registry`、reason 必須)
- `required/<機能名>.ts` … この fork が必ず使う機能(器)
- `extensions/` … 生成一覧(`pnpm extensions:generate`、編集しない)
- `index.ts` … server・proxy の入口(`gate.enabled(name)`・`gate.path(pathname)` と型)
- `client.ts` … client の入口(器)
- `node.ts` … 道具の入口(scripts と test だけ。規則の一覧・`gatedSchema`・`closedTables`)
- `evaluate.ts` … 判定の中身(外に出さない)/ `tools/server/`・`tools/client/` … 1 道具 1 ファイルと束
- `checks/` … 検査(`pnpm test:feature-gate`)

## 判定

- `gate.enabled(name)`: 規則の `enabled()` の答え。未知の名前は型で落ち、実行時は throw
- `gate.path(pathname)`: 一覧の順(ファイル名の順)で最初の閉じた規則に当たれば `{ open: false, rule, redirectTo }`(開いていれば `{ open: true }`)

規則の書き方と効き方(ルートゲート・スキーマゲート): `types.ts` の `FeatureGateRule`、`src/proxies/README.md`。
