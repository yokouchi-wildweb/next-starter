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
    xs: "space-y-1",
    sm: "space-y-2",
    md: "space-y-4",
    lg: "space-y-6",
    xl: "space-y-8",
  },
} as const;
