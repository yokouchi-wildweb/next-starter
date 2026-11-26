// src/lib/formSuite/extensionPoints.ts
// フォーム一式(lib)の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 一覧と結び目は生成物 src/wiring/formSuite.ts(pnpm generate extensions、D31)。lib は一覧を読まない

export const extensionPoints = {
  // 独自の入力部品: 差す側の <ドメイン>/plugs/formInputs/<名前>.ts(lib は <lib>/plugs/…)の export const formInput(登録名 name と読み込み関数だけ。部品の本体は普通の置き場)。
  // 登録名 name は全体で一意(entity.json の formInput が引く)
  formInputs: {
    change: "add",
    plugs: true,
    export: "formInput",
    type: { from: "@/lib/formSuite/points", name: "FormInputItem" },
    side: "client",
    key: "name",
    target: "wiring",
  },
};

// 結び目: src/wiring/formSuite.ts の FormInputsRoot(子を包む client の部品)が FormInputsProvider に useGate().plugs で絞った一覧を渡し、登録名を RegisteredFormInputs に広げる
export const wire = { name: "FormInputsProvider", export: "FormInputsRoot", side: "client", registers: "RegisteredFormInputs" };
