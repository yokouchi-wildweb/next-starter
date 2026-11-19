// src/config/lib/fonts.ui.config.ts
// 書体(Web フォントの読み込み)の上書き(@lib-config/fonts.ui)。持ち主と既定: src/lib/fonts/config.ui.ts(何も渡さなければ system フォント)
// next/font のローダーをトップレベルの const でリテラルの引数で呼び、その結果を渡す。variable は固定名
// (sans = "--font-sans-loaded"、mono = "--font-mono-loaded"。pnpm test src/lib/fonts/fonts.test.mjs が字面で検査する)
// 例: Google Fonts(ビルド時に取得・セルフホスト化される)
//   import { Noto_Sans_JP } from "next/font/google";
//   const sans = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-sans-loaded", display: "swap" });
//   export default { sans } satisfies FontsOverride;
// 例: ローカルフォント(src/assets/fonts 等)
//   import localFont from "next/font/local";
//   const sans = localFont({ src: "../../assets/fonts/Brand.woff2", variable: "--font-sans-loaded", display: "swap" });
// Web フォントを使わず system フォントの並びだけ変えるなら、ここは触らず src/styles/typography.css に :root { --font-geist-sans: …; }
import type { FontsOverride } from "@/lib/fonts/config.ui";

export default {} satisfies FontsOverride;
