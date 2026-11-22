# definitions(購入完了ポストフックの受け口)

## Overview

購入の完了の後に動くフックの受け口。`<名前>.ts` に `export const hook: PurchaseCompleteHook` を置き、`pnpm generate extensions`。上流の項目は 0。

## Related

- 書き方: `src/domains/core/purchaseRequest/README.md` Extension「購入完了ポストフック」
- 受け口の仕組み: `scripts/structure/extensions/README.md`
