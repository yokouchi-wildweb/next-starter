/**
 * 書体(Web フォント読み込み)の設定
 *
 * ★ このファイルは下流所有です。upstream は初回作成後に編集しません。
 *   何も渡さなければ Web フォントは読み込まれず、system フォントのスタックで表示されます(従来どおり)。
 *
 * 仕組み: next/font のローダーを `variable` オプション付きで呼び、その結果を渡すと
 *   root layout が <html> にクラスを当て、CSS 変数 --font-sans-loaded / --font-mono-loaded が定義されます。
 *   src/styles/typography.defaults.css のスタックがその変数をフォールバック付きで参照しているため、
 *   theme.css や Tailwind の font-sans / font-mono は何も変えずに新しい書体になります。
 *
 * ⚠️ next/font の制約: ローダー呼び出しはモジュールのトップレベルで、引数はリテラルで書くこと
 *   (変数や import した定数を渡すとビルドエラー)。`variable` は下記の固定名をそのまま書く。
 *
 * 例: Google Fonts(ビルド時に取得・セルフホスト化される)
 *   import { Noto_Sans_JP } from "next/font/google";
 *   const sans = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-sans-loaded", display: "swap" });
 *   export const FONTS_CONFIG = defineFontsConfig({ sans });
 *
 * 例: ローカルフォント(public/ 以外、src/assets/fonts 等に置く)
 *   import localFont from "next/font/local";
 *   const sans = localFont({ src: "../../assets/fonts/Brand.woff2", variable: "--font-sans-loaded", display: "swap" });
 *   export const FONTS_CONFIG = defineFontsConfig({ sans });
 *
 * 例: 等幅も差し替える
 *   const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-loaded" });
 *   export const FONTS_CONFIG = defineFontsConfig({ sans, mono });
 *
 * Web フォントを使わず system フォントの並びだけ変えたい場合は、このファイルは触らず
 * src/styles/custom/typography.css に `:root { --font-geist-sans: "Hiragino Sans", ...; }` と書く。
 * 詳細: src/styles/README.md
 */

import { defineFontsConfig } from "@/lib/fonts";

export const FONTS_CONFIG = defineFontsConfig({});
