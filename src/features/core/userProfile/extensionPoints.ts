// src/features/core/userProfile/extensionPoints.ts
// userProfile の拡張点の宣言(リテラルだけ)。一覧は profiles/*.profile.json から pnpm generate role が ./extensions/<点>.ts を書く。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  profileBases: { writer: "role:generate", side: "server" },
  profileConfigs: { writer: "role:generate", side: "shared" },
  profileSchemas: { writer: "role:generate", side: "shared" },
  profileTables: { writer: "role:generate", side: "server" },
  // 上書きの対象: プロフィールの JSON。隣の <JSON の名前>.override.ts が書いてよい鍵(表の形を変える fields は無い)
  profileDefinitions: {
    overrides: "src/features/core/userProfile/profiles/*.profile.json",
    side: "shared",
    overrideOf: ["tags", "searchFields", "audit"],
  },
};
