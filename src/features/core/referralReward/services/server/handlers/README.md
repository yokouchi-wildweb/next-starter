# handlers(報酬ハンドラーの受け口)

## Overview

- 紹介報酬の中身(ポイント付与・クーポン発行等)を実行するハンドラーを置く受け口。上流の項目は 0

## Usage

- `<名前>.ts` に `export const handler: RewardHandlerItem` を置き、`pnpm generate extensions`

## Related

- 書き方: `src/features/core/referralReward/README.md` の Extension
- 受け口の仕組み: `scripts/structure/extensions/README.md`
