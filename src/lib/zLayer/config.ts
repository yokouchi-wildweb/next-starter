// src/lib/zLayer/config.ts
//
// zLayer の設定(既定 + 上書き)。上書きは src/config/lib/zLayer.config.ts(@lib-config/zLayer)。
// 中身 = fork が足す自分の層(当議会 D189・D194): { name, above } の並び。above はページの層(background … forefront)か
// 先に書いた自分の層だけ。値と class は pnpm generate styles が src/styles/z-layer.css と generated/ownLayers.ts に書く
// (このファイルは生成が読む。アプリは generated/ownLayers.ts の一覧だけを使う)。

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/zLayer";

/** 自分の層の宣言 */
export type OwnLayerDecl = {
  /** 層の名(kebab-case、上流の名と重ならない) */
  name: string;
  /** どの層の上に置くか(ページの層か、この並びで先に書いた自分の層) */
  above: string;
};

export type ZLayerConfig = {
  /** 自分の層(書いた順。同じ above の層は後に書いた物が上) */
  layers: OwnLayerDecl[];
};

const defaults: ZLayerConfig = { layers: [] };

export const zLayerConfigDef = defineConfig(defaults, { label: "zLayer" });

/** 上書きのファイルの型 */
export type ZLayerOverride = OverrideOf<typeof zLayerConfigDef>;

export const zLayerConfig = zLayerConfigDef.compose(override);
