// src/domains/core/pairedDevice/extensionPoints.ts
// pairedDevice の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 端末の種類: 差す側の <ドメイン>/plugs/pairedDeviceKinds/<名前>.ts の export const kind = definePairedDeviceKind({ kind: "<名前>", ... })(上流の項目は 0。kind は全体で一意、型は PairedDeviceKindsMap から導く)
  pairedDeviceKinds: {
    change: "add",
    plugs: true,
    export: "kind",
    type: { from: "@/domains/pairedDevice/types/kind", name: "AnyPairedDeviceKindDefinition" },
    side: "server",
    key: "kind",
    literalKeys: true,
    shape: "object",
  },
};
