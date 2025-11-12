export const layoutVariants = {
  /** 見た目のバリエーション */
  visualEffect: {
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
  /** コンテナの内側余白 */
  padding: {
    none: "",
    sx: "p-1",
    sm: "p-2",
    md: "p-3",
    lg: "p-4",
    xl: "p-6",
  },
  /** コンテナの外側余白 */
  margin: {
    none: "",
    sx: "m-1",
    sm: "m-2",
    md: "m-3",
    lg: "m-4",
    xl: "m-6",
  },
} as const;
