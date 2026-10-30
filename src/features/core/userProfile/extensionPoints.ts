// src/features/core/userProfile/extensionPoints.ts
// userProfile の拡張点の宣言(リテラルだけ)。一覧は profiles/*.profile.json から pnpm role:generate が ./extensions/<点>.ts を書く。書式: scripts/extensions/README.md

export const extensionPoints = {
  profileBases: { writer: "role:generate", side: "server" },
  profileConfigs: { writer: "role:generate", side: "shared" },
  profileSchemas: { writer: "role:generate", side: "shared" },
  profileTables: { writer: "role:generate", side: "server" },
};
