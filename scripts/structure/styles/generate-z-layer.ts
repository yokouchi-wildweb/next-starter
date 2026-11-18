// scripts/structure/styles/generate-z-layer.ts — 自分の層の CSS と型を作る(pnpm generate styles、当議会 D189・D194・D187)
//   - src/styles/z-layer.css = このリポの層の値と class(fork 所有、global.css が読む)
//   - src/lib/zLayer/generated/ownLayers.ts = 名と above の一覧(ZLayerName・PageLayerName が読む)
// 設定 src/config/lib/zLayer.config.ts の layers を検証(zLayerOwn.mjs)し、誤りがあれば理由を出して exit 1(何も書かない)。

import * as fs from "fs";
import * as path from "path";

import { PAGE_LAYER_NAMES } from "@/lib/zLayer";
import { zLayerConfig } from "@/lib/zLayer/config";

import { assignOwnLayers, parseUpstreamLayers, renderOwnLayerCss, renderOwnLayersTs } from "./zLayerOwn.mjs";

const UPSTREAM_CSS = "src/styles/core/z-layer.css";
const CSS_OUT = "src/styles/z-layer.css";
const TS_OUT = "src/lib/zLayer/generated/ownLayers.ts";

const root = process.cwd();
const upstream = parseUpstreamLayers(fs.readFileSync(path.join(root, UPSTREAM_CSS), "utf8"));
const forkCss = fs
  .readdirSync(path.join(root, "src/styles"))
  .filter((f) => f.endsWith(".css") && `src/styles/${f}` !== CSS_OUT)
  .map((f) => ({ file: `src/styles/${f}`, css: fs.readFileSync(path.join(root, "src/styles", f), "utf8") }));

const result = assignOwnLayers({ upstream, pageNames: [...PAGE_LAYER_NAMES], decls: zLayerConfig.layers, forkCss });
if (!result.ok) {
  console.error(`❌ 自分の重なりの層(src/config/lib/zLayer.config.ts)に誤りが ${result.errors.length} 件(何も書いていません。src/lib/zLayer/README.md)`);
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}
const write = (rel: string, body: string) => {
  const abs = path.join(root, rel);
  const before = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
  if (before === body) return console.log(`✓ ${rel} は最新`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  console.log(`生成完了: ${rel}`);
};
write(CSS_OUT, renderOwnLayerCss(result.layers));
write(TS_OUT, renderOwnLayersTs(result.layers));
