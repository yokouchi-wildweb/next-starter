# interactionTracking/targetRules

## Overview

- 公開 ingest(`POST /api/interactions` / `/batch`)の計測対象の規則の受け口。上流の項目は 0。項目が無い targetType は拒否(fail-closed)
- 仕組み: `scripts/structure/extensions/README.md`

## Usage

- `<名前>.ts` に `export const rule: InteractionTargetRule`(`targetType` 必須)を置き、`pnpm generate extensions`
- 書き方の例: `../README.md` Usage「1. 計測対象を登録」

## API

- 型 `InteractionTargetRule`(`@/features/core/interactionTracking/types/targetRule`): `targetType` / `allowedActions` / `batchActions`(バッチ経路で受ける action) / `validate(targetId)` / `retentionDays`(明細の保持日数の上書き) / `recordDetail`(false = 明細を書かず集計だけ)
- `targetType` が鍵(重複は生成で例外)
