# 独自の入力部品の登録

1 部品 1 ファイルで `<名前>.ts` を置くと、欄の定義に `formInput: "<name>"` と書ける（domain.json・profile.json・setting の欄・手書きの FieldConfig）。`pnpm extensions:generate`（forge が回す）が一覧を作る。

```ts
// src/wiring/formInputs/inputs/ticketRates.acme.ts
import type { FormInputItem } from "@/components/Form/Field/types";

export const formInput = {
  name: "ticketRates",
  load: () => import("@/features/foo/components/common/TicketRatesInput"),
  frame: false,
} as const satisfies FormInputItem;
```

- `name`: 組み込みの入力種別（`src/lib/domain/fields/formInputs.mjs`）と同じ名前は不可
- `load`: 部品の本体を `import()` で返す（default export。使う画面で初めて読み込む）
- `frame`（既定 true）: true はラベル・必須印・説明(欄の `helperText`)・エラーの枠を共通で描く。部品が自分で枠や複数の欄を描くなら false（エラーの表示だけ残る）
- `blurMode`（既定 `"none"` = blur で自動保存しない）: 単一値の部品で自動保存を効かせるなら `"immediate"` か `"debounce"`

部品は `{ field, fieldConfig, inputClassName, id, "aria-describedby", "aria-invalid" }` を受ける（`FormInputProps`）。`id`・`aria-*` を入力要素に渡すとラベルと結び付く。

`frame: false` でも共通の枠が出すのは欄そのもののエラー（全体の `refine` など）だけ。内側の欄のエラー（`rates.min` など）は部品が自分で描く（`useFormState` の `errors`）。

登録は描画だけ。初期値・Zod・列は `fieldType` が決め、一覧の表示（presenter）は含めない。
