# alwaysOnExceptions

常時実行の入口の例外の受け口(1 項目 1 ファイル `<名前>.ts`、名前は英字始まりの英数字、fork の印は付けない)。上流の項目は 0。

```ts
import type { AlwaysOnException } from "@/featureGate";
// 常に読み込まれる結線のうち、表を持つ機能のフォルダを import してよいもの
export const exception: AlwaysOnException = { file: "src/wiring/foo.ts", reason: "<閉じなくてよい理由>" };
// または fork の手書きの登録表(中の名前は ...(<条件> ? [x] : []) の内側で使う)
// export const registry: AlwaysOnException = { file: "src/registry/fooCleanup.ts", reason: "<常に読まれる理由>" };
```

どちらか 1 つ、reason は必須、当たらない行は失敗(縮む表)。検査: `pnpm test src/featureGate scripts/structure/proxies`
