import { cva } from "class-variance-authority";
import { appearance } from "./appearance";
export { appearance } from "./appearance";

/**
 * Layout 部品の共通のバリアント(見た目だけ)。余白 prop は cva に載せず spacing.ts の boxSpacingClassName で付ける
 * (余白の class は生成した表から引く。variants の上書きで余白の表を書き換えられないようにする)
 */
export const layoutVariants = {
  appearance,
} as const;

export const createLayoutVariants = (baseClass: string) =>
  cva(baseClass, {
    variants: layoutVariants,
  });
