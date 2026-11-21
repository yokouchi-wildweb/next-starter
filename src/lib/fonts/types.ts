// src/lib/fonts/types.ts
//
// 書体設定の型。next/font のローダー結果(NextFontWithVariable)を構造的に受け取る。
// next/font の内部型パスに依存しないよう、必要な 2 プロパティだけを自前で定義する。

/** next/font/google・next/font/local のローダーが `variable` オプション付きで返すオブジェクトの必要部分 */
export type LoadedFont = {
  /** `variable` オプションで指定した CSS 変数を定義するクラス名(next/font が生成) */
  variable: string;
  /** font-family を直接当てるクラス名(本基盤では使わない。参照はスタック側の CSS 変数経由) */
  className: string;
};

/** 合成済みの設定(上書き FontsOverride の型は ./settings.ts。next/font のローダーの variable は固定名
 *   sans → "--font-sans-loaded" / mono → "--font-mono-loaded"、src/styles/core/typography.css がこの名前でフォールバック参照する) */
export type FontsConfig = {
  sans: LoadedFont | null;
  mono: LoadedFont | null;
  /** `<html>` に当てるクラス(読み込んだフォントの variable クラスを連結。無ければ空文字) */
  className: string;
};
