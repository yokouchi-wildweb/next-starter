# scripts/structure/message — 新しい連絡の書き出し

fork(と上流)が新しい連絡を足す時の 3 本を、上流の連絡と同じ形で書き出す(D24・D25・D57)。書いた後は手で直すファイル(write-once)。

```
pnpm generate message -- <domain> <name> [--kind marketing|activity|transactional] [--category <key>] [--channels email,inApp] [--core]
```

- 書く物(無い時だけ。あれば触らず「残しました」と出して exit 0):
  - `src/features/<domain>/messages/<name>.ts` — 定義(`defineMessage`。鍵 `<domain>.<name>`・kind・category・例の vars 1 つ・defaultChannels・経路ごとの欄)。秘密の値(`secretVar`)・管理画面で直せる欄(`adminEditable`)・会話の間引き(`throttle`)・本文の残し方(`record`)は注記の行で案内するだけで付けない
  - `messages/views/<name>.tsx` — メールの描き方の 1 行スイッチ(`export { EmailView } from "./<name>.default"`)
  - `messages/views/<name>.default.tsx` — 既定の描き方(lib/mail の部品。メールの経路の既定と同じ見た目)。email の無い連絡は描き方を書かない
- 書いた時は `pnpm generate registry`(`src/registry/messageRegistry.ts`)と `pnpm generate extensions`(1 行スイッチの受け口の一覧の行)を回す
- 既定: `--kind transactional`、`--channels email,inApp`。経路は経路の受け口の項目(上流 email・inApp・line と fork の経路)。fork の経路の欄は空(`{}` + 注記)なので、経路の fields に合わせて書く
- category: categories の受け口の鍵(上流 marketing・activity と fork の項目)。`marketing` / `activity` は必須、取引は省ける(src/lib/messaging/README.md の category の決まり)
- 引数なし(`pnpm generate` の一括)= 何もしない(exit 0)。質問はしない(-i は無い)
- exit 2(書かない、理由を出す): 知らない引数・`<domain>` が features の地区に無い・`<name>` が英小文字始まりの camelCase でない・core のドメインに `--core` が無い(fork の持ち場の外 = `pnpm workflow ownership check` が落ちる)・知らない kind・受け口に無い category・marketing / activity に category が無い・知らない経路

中身: `scaffold.mjs`(引数・検査・書き出し)、`templates.mjs`(雛形)、`generate.mjs`(門の入口)。テスト: `pnpm test scripts/structure/message/scaffold.test.ts`(一時の木で書き、validateMessageDefinition と messageGuards を通す)
