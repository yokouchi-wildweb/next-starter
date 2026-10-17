/**
 * primitive(Button / Badge)の variant オーバーライド
 *
 * ★ このファイルは下流所有です。upstream は初回作成後に編集しません。
 *   何も書かなければ upstream の見た目のまま。書いたクラスが cva の出力の後ろに結合され、
 *   同じプロパティは後勝ち(tailwind-merge)で置き換わります。各要素の className はさらにその後ろ。
 *
 * 使えるキー(upstream が維持する契約。variant / size 名は各コンポーネントの定義と同じ):
 *   button        src/components/Form/Button/button-variants.ts      (Button / LinkButton / PseudoButton 共通)
 *   tabletButton  src/components/Form/Button/tablet-button-variants.ts
 *   badge.size    src/components/Badge/badge-variants.ts              (3 種のバッジで共有)
 *   badge.solid / badge.soft / badge.bookmarkTag                      (base / variant)
 *
 * 例: ボタンを全て丸く・影なしにし、outline だけ太枠、md の高さを変える
 *   defineVariantOverrides({
 *     button: {
 *       base: "rounded-full shadow-none",
 *       variant: { outline: "border-2" },
 *       size: { md: "h-11 px-5" },
 *     },
 *   })
 *
 * 例: バッジを角丸の小さい四角にする
 *   defineVariantOverrides({
 *     badge: { solid: { base: "rounded-md" }, soft: { base: "rounded-md" }, size: { md: "px-2 py-0.5" } },
 *   })
 *
 * ⚠️ 置き換えたいクラスと同じ修飾子(hover: / dark: / focus-visible: 等)を付けること。
 *    `hover:bg-primary/90` を消したいなら `hover:bg-primary/80` のように同じ hover: で上書きする。
 * ⚠️ 色はここではなく src/styles/custom/palette.css で変える(トークンを変えれば全部品に効く)。
 *    ここは形(角丸・影・枠線・寸法)の差し替えに使う。
 * 詳細: src/styles/README.md「variant オーバーライド」
 */

import { defineVariantOverrides } from "@/lib/variantOverrides";

export const VARIANT_OVERRIDES = defineVariantOverrides({});
