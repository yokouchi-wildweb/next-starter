// src/features/core/user/extensionPoints.ts
// user の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // 表示名の予約名プロバイダ: reservedNames/<名前>[.<fork の名前>].ts の export const provider(上流の項目は 0)
  reservedNames: {
    dir: "reservedNames",
    export: "provider",
    type: { from: "@/features/core/user/types", name: "ReservedUserNameProvider" },
    side: "server",
  },
  // 退会・ソフトデリートの後片付け: cleanupHandlers/<名前>[.<fork の名前>].ts の export const handler
  cleanupHandlers: {
    dir: "cleanupHandlers",
    export: "handler",
    type: { from: "@/features/core/user/services/server/cleanup", name: "UserCleanupItem" },
    side: "server",
    alwaysOn: true,
  },
};
