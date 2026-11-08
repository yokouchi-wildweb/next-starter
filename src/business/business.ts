// src/business/business.ts — このプロジェクトの事業の素性(fork の物。フォルダごと fork が書く)
// source: "sample" の間は @/business が例の値(src/lib/business/examples/business.ts)を返し、本番のビルドは止まる。
// 自分の値にする: pnpm ops business from-example(例を写して own)か pnpm ops business blank(空の欄で own)。形: src/lib/business/README.md
import type { BusinessFile } from "@/lib/business";

export default { source: "sample" } satisfies BusinessFile;
