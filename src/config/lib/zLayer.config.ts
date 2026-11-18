// src/config/lib/zLayer.config.ts
// zLayer の設定の上書き(@lib-config/zLayer)。値はリテラルで書く。
// 自分の層: layers: [{ name: "game-effect", above: "forefront" }] のように足し、pnpm generate styles で CSS と型を作る。
// above はページの層(background・content・backside-ui・below-header・header・above-header・forefront)か先に書いた自分の層だけ。
// 書き方と失敗の条件: src/lib/zLayer/README.md
import type { ZLayerOverride } from "@/lib/zLayer";

export default {} satisfies ZLayerOverride;
