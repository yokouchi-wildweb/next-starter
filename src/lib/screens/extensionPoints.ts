// src/lib/screens/extensionPoints.ts
// 画面の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 置き場: 上流のルートの隣の _components/(fork の部品。./checks.mjs の FORK_OWNED_DIR)。
  // ページ・枠の 1 行スイッチの行はルートから作る(scripts/structure/extensions/intake.mjs)
  forkScreenParts: { placement: "src/app/**/_components/**", kind: "edit" },
} as const;
