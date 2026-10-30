// src/features/core/pairedDevice/extensionPoints.ts
// pairedDevice の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // 端末の種類: kinds/<名前>[.<fork の名前>].ts の export const kind = definePairedDeviceKind({ kind: "<名前>", ... })(上流の項目は 0)
  kinds: {
    dir: "kinds",
    export: "kind",
    type: { from: "@/features/core/pairedDevice/types/kind", name: "AnyPairedDeviceKindDefinition" },
    side: "server",
    key: "kind",
    literalKeys: true,
  },
};
