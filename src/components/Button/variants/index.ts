// src/components/Button/variants — ボタンの見た目の表(Button / LinkButton / PseudoButton と TabletButton)の入口。説明: ../README.md
export { buttonVariants, type ButtonStyleProps } from "./button-variants";
export { tabletButtonVariants, type TabletButtonStyleProps } from "./tablet-button-variants";
// variant / size の名前の型は @/lib/variantOverrides が持つ(ここは部品の props の型として見せるだけ。二つ目の定義を作らない)
export type {
  ButtonSizeName,
  ButtonVariantName,
  TabletButtonSizeName,
  TabletButtonVariantName,
} from "@/lib/variantOverrides";
