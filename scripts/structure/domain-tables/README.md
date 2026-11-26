# scripts/structure/domain-tables — 表ごとの宣言(entity.json)と今の表の照らし

## Overview

- 表ごとの宣言 `src/domains/<d>/entities/<登録名>/entity.json`(形は `src/lib/domain/README.md`「宣言の形」)を正として、今の表の定義がそれと同じかを値で比べる検査です(D332・D336)
- 宣言から表を組む手段は生成器の 1 つだけ(`pnpm generate domain` の entities/drizzle.ts の組み立て)。検査は、宣言から生成器で組んだ表と、今の表(物理名で引いた pgTable)を両方読み込み、drizzle の `getTableConfig` の値で比べます
- 照らす物: 列(型・NOT NULL・既定・主キー・identity・ユニーク・enum の名前と値)・主キー・FK(列・相手・onDelete / onUpdate)・索引(ユニーク・列か式・向き・where・方式)・check・ユニーク制約。`dbObjects` は名指したファイル(ドメインのフォルダからの相対)が在るか
- 照らす登録: entity.json の読めた Neon の登録全部(生成する登録も手で持つ登録も)。Firestore は表が無いので照らしません

## Usage

```
pnpm check domain-tables
```

- 段階 ship に乗ります(`phase.json`。check = `tables.test.mjs`、登録 1 件 = テスト 1 つ)。照らす登録が無ければ「照らす登録なし」で通ります
- 違いは `<表>: <どこ>: 宣言 <値> / 今 <値>` の行で出ます。どちらが正しいかを決めて片方を直します: 動いている表が正しい → entity.json を直す、宣言が正しい → 表の定義を直す(生成する登録は `pnpm generate domain`、表の変更は notice の `[user-run] db:push`)。権限・制約を黙って変えない

## Internals

- `facts.mjs`: `tableFactsOf(pgTable)`(平らな表「どこ → 値」、SQL の式は PgDialect で文字列)・`diffTableFacts(expected, actual)`
- `tables.mjs`: `registrationsToMatch`(readDomains から)・`expectedTable`(生成器の出力を OS の一時フォルダに書き、import の道をこのリポジトリの実物の道に直して読む)・`actualTable`(地区の地図の tableFiles)・`missingDbObjects`
- .ts を読むので tsx の上で走ります(段の検査と `pnpm test` は tsx の cli で起こす)

## Verification

- `pnpm test scripts/structure/domain-tables/facts.test.mjs`(違いの出し方と、sampleTag の宣言から組んだ表が今の表と同じか)

## Related

- 宣言の読み込み: `src/lib/domain`(`readDomains`)/ 段階の仕組み: `scripts/runner/phases/README.md`
