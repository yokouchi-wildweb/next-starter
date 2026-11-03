// src/components/Layout/appearance.ts
//
// Layout 系(Block / Section / Stack / Flex / Grid / Main)の appearance。
// 色は全てテーマトークン(card / border / muted / primary ...)で書く。生パレット色(slate-900 等)は
// ブランド色に追従せず dark: 併記も必要になるため使わない(ESLint style-tokens/no-raw-palette)。
// ダークモードの色はトークン側(palette.defaults.css の .dark)が持つので、透過率が変わる箇所だけ dark: を書く。
// ダークの --border は白 10% と薄いため、輪郭線が主役の appearance は dark: で muted-foreground の透過に切り替える。
// 影は appearance ごとのトークン --appearance-shadow-<name>(palette.defaults.css の :root / .dark が値を持つ)。
// ここに影の値を直書きしない。fork は src/styles/palette.css で値を変える(src/styles/README.md)。

export const appearance = {
  surface: [
    "bg-card/80",
    "text-card-foreground",
    "shadow-none",
    "ring-1",
    "ring-border/60",
    "dark:bg-card",
    "dark:ring-muted-foreground/20",
  ].join(" "),
  raised: [
    "bg-card",
    "text-card-foreground",
    "shadow-(--appearance-shadow-raised)",
    "ring-1",
    "ring-secondary/10",
  ].join(" "),
  outlined: [
    "bg-card/30",
    "text-card-foreground",
    "ring-1",
    "ring-border",
    "shadow-(--appearance-shadow-outlined)",
    "dark:bg-card/80",
    "dark:ring-muted-foreground/30",
  ].join(" "),
  frosted: [
    "bg-muted/75",
    "text-foreground",
    "backdrop-blur-2xl",
    "ring-1",
    "ring-background/60",
    "shadow-(--appearance-shadow-frosted)",
    "dark:bg-muted/40",
    "dark:ring-secondary/10",
  ].join(" "),
  soft: [
    "bg-gradient-to-br",
    "from-muted/60",
    "via-card",
    "to-muted",
    "text-card-foreground",
    "ring-1",
    "ring-border/70",
    "shadow-(--appearance-shadow-soft)",
    "dark:from-card",
    "dark:via-card/70",
    "dark:to-card/40",
    "dark:ring-muted-foreground/30",
  ].join(" "),
  radiant: [
    "bg-gradient-to-r",
    "from-[color:color-mix(in_oklch,_var(--color-primary)_10%,_var(--color-background))]",
    "via-[color:color-mix(in_oklch,_var(--color-primary)_5%,_var(--color-card))]",
    "to-[color:color-mix(in_oklch,_var(--color-secondary)_10%,_var(--color-background))]",
    "text-[color:var(--color-foreground)]",
    "ring-1",
    "ring-[color:color-mix(in_oklch,_var(--color-primary)_16%,_transparent)]",
    "shadow-(--appearance-shadow-radiant)",
    "dark:from-[color:color-mix(in_oklch,_var(--color-primary)_12%,_var(--color-background))]",
    "dark:via-[color:color-mix(in_oklch,_var(--color-primary)_7%,_var(--color-card))]",
    "dark:to-[color:color-mix(in_oklch,_var(--color-secondary)_10%,_var(--color-background))]",
    "dark:text-[color:var(--color-foreground)]",
    "dark:ring-[color:color-mix(in_oklch,_var(--color-primary)_22%,_transparent)]",
  ].join(" "),
} as const;
