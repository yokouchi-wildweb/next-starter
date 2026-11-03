// src/wiring/formInputs/extensionPoints.ts
// 独自の入力部品の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md
// 宣言と受け口をここに置く理由: src/components/Form は一覧を知らない(FormInputsRoot が渡す)

export const extensionPoints = {
  // 入力部品: inputs/<名前>.ts の export const formInput(名前と読み込み関数だけ。部品の本体は普通の置き場)
  inputs: {
    dir: "inputs",
    export: "formInput",
    type: { from: "@/components/Form/Field/types", name: "FormInputItem" },
    side: "client",
    key: "name",
    literalKeys: true,
  },
};
