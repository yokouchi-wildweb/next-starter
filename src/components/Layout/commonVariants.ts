export const layoutVariants = {
  /** 見た目のバリエーション */
  variant: {
    /** 最もシンプルなブロック */
    default: "",
    /** 囲み枠で少しだけ強調したいとき */
    outline: "border border-border",
    /** 影を付けて存在感を出したいとき */
    raised: "shadow-lg",
  },
  /** 子要素同士の縦方向スペース */
  space: {
    none: "",
    xs: "space-y-2",
    sm: "space-y-4",
    md: "space-y-6",
    lg: "space-y-8",
    xl: "space-y-10",
  },
} as const;
