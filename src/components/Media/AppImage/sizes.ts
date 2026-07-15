// src/components/Media/AppImage/sizes.ts
//
// AppImage の sizes プリセット。
// next/image の sizes は「この画像が実際に表示される幅」をブラウザに教えるヒントで、
// 忘れると全幅(100vw)相当の srcset が選ばれ、せっかくの最適化が無駄になる。
// 呼び出し側が毎回メディアクエリ文字列を書かなくて済むよう、代表的な用途をプリセット化する。
// 保守的なデフォルト値で出荷しており、フォーク側でレイアウトに合わせて調整してよい。

export const APP_IMAGE_SIZES_PRESETS = {
  /** 一覧のサムネイル・アバター等の小さい画像 */
  thumb: "(max-width: 768px) 33vw, 160px",
  /** カードグリッドの画像(モバイル2列・PC3〜4列想定) */
  card: "(max-width: 768px) 50vw, 400px",
  /** ファーストビューの大型ビジュアル */
  hero: "100vw",
  /** 画面幅いっぱいに表示される画像 */
  full: "100vw",
} as const;

export type AppImageSizesPreset = keyof typeof APP_IMAGE_SIZES_PRESETS;

/** プリセット名ならその定義値へ、生の sizes 文字列ならそのまま返す */
export function resolveSizes(sizes: AppImageSizesPreset | (string & {})): string {
  return APP_IMAGE_SIZES_PRESETS[sizes as AppImageSizesPreset] ?? sizes;
}
