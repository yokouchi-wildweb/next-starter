# DOWNSTREAM NOTICE id:20261028-234429-form-array-field-types
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-28T23:44:29+09:00
severity: info
checkpoint: form-array-field-types
change: フォーム側（src/components/Form）の型の手書きを生成器の型の表に合わせた。作成フォームの既定値で `stringArray` と `mediaCollection`（集まり）が `""` ではなく `[]` になる | `formInput: "checkbox"` の `stringArray` が 1 つのチェックボックスではなく複数選択（CheckGroupInput）になる（判定は `Field/Configured/checkGroupFieldTypes.ts`）| `FieldDataType` / `FieldDataTypeFirestore` に `stringArray`（Neon は `mediaCollection` も）を足した。ずれは `pnpm test:form-defaults`（と typecheck）が生成器の型の表（scripts/domain-config/spec）と突き合わせて検知する
why: 既定値の `""` が配列のスキーマを通らず、集まりや stringArray を持つ作成フォームの送信が落ちうる。stringArray の checkbox は値の形（配列）と入力欄（真偽）が合っていなかった
required_actions: none
verify: `pnpm typecheck` `pnpm lint` `pnpm test:form-defaults` が通る | stringArray を checkbox で持つ項目があれば、その作成・編集フォームで複数選択の checkbox が出て保存できる
manual_steps: -
refs: src/components/Form/FieldRenderer/defaultValueBuilder.ts, src/components/Form/Field/Configured/checkGroupFieldTypes.ts, src/components/Form/Field/types.ts, src/components/Form/FieldRenderer/README.md
notes:
- 生成物は変わらない（生成器の変更はコメントだけ）。DB の変更なし
- fork が stringArray の checkbox を独自の入力欄（custom）で回避していれば、そのままでよい。formInput を checkbox に戻せば複数選択になる
- 型の解釈を生成器に一本化する検討（アプリ側で実行時に型を解釈しない・型を部品にする）は評議会 20261028-234023-field-type-single-interpretation で進めている。結論しだいでこの手書きと突き合わせのテストは置き換わる
- fork の状態: src/features/*/domain.json の stringArray は oripa-do の shippingRequest.promotion_ids（formInput multiSelect、components: false）の 1 件だけ（88-base TriQ boardgame-site next-vnx oripa-demo oripa-do-2 は 0 件）。checkbox の stringArray はどの fork にも無い。手書きのフォームでの使い方は not checked
- 削除・移動なし。追加: src/components/Form/Field/Configured/checkGroupFieldTypes.ts
