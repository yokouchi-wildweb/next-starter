// src/domains/core/userProfile/extensionPoints.ts
// userProfile の拡張点の宣言(リテラルだけ)。一覧は profiles/*.profile.json から pnpm generate role が ./extensions/<点>.ts を書く。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  profileBases: { change: "add", writer: "role:generate", side: "server" },
  profileConfigs: { change: "add", writer: "role:generate", side: "shared" },
  profileSchemas: { change: "add", writer: "role:generate", side: "shared" },
  profileTables: { change: "add", writer: "role:generate", side: "server" },
  // 上書きの対象: プロフィールの JSON。隣の <JSON の名前>.override.ts が書いてよい鍵(表の形を変える fields は無い)
  profileDefinitions: {
    change: "override",
    overrides: "src/domains/core/userProfile/profiles/*.profile.json",
    addable: true,
    export: "override",
    side: "shared",
    overrideOf: ["tags", "searchFields", "audit"],
  },
} as const;

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
