# src/proxies/redirects — 転送の規則の受け口

1 ファイル = 規則の 1 組。`src/proxies/redirects/<名前>.ts` に `export const redirects: RedirectRuleGroup = [...]` を書き、`pnpm generate extensions` で `src/proxies/extensions/redirects.ts` に並ぶ(上流の項目は 0)。読み手は `src/proxies/redirect.ts`。

```ts
// src/proxies/redirects/campaign.ts(fork の例)
import type { RedirectRuleGroup } from "@/proxies/types";

export const redirects: RedirectRuleGroup = [
  { sourcePaths: ["/old-campaign"], destination: "/campaign", authedOnly: false },
];
```

- 規則の形と条件の優先順: `RedirectRule`(`src/proxies/types.ts`)
- 同じ `sourcePath` が 2 つの規則にあると読み込みで止まる(どちらが効くかを並びで黙って決めない)
- サインアップの方式による内部の規則(`/signup` ⇄ `/entry`)は `redirect.ts` のコードにあり、ここには書かない
- fork が独立した行を足す一覧は受け口、鍵で合わせる表は config(`src/config/README.md`)
