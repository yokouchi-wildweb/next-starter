// src/components/Layout/appearance.ts
//
// Layout 系(Block / Section / Stack / Flex / Grid / Main)の appearance。
// 色は全てテーマトークン(card / border / muted / primary ...)で書く。生パレット色(slate-900 等)は
// ブランド色に追従せず dark: 併記も必要になるため使わない(ESLint style-tokens/no-raw-palette)。
// ダークモードの色はトークン側(palette.defaults.css の .dark)が持つので、透過率が変わる箇所だけ dark: を書く。
// ダークの --border は白 10% と薄いため、輪郭線が主役の appearance は dark: で muted-foreground の透過に切り替える。
// 影の rgba リテラルはブランド色に追従しない(lint は shadow-[...] を対象外)。追従させたい場合は radiant と同じ color-mix で書く。

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
    "shadow-[0_20px_60px_-15px_rgba(30,64,175,0.3)]",
    "ring-1",
    "ring-secondary/10",
    "dark:shadow-[0_20px_60px_-15px_rgba(96,165,250,0.45)]",
  ].join(" "),
  outlined: [
    "bg-card/30",
    "text-card-foreground",
    "ring-1",
    "ring-border",
    "shadow-[0_1px_2px_rgba(15,23,42,0.08)]",
    "dark:bg-card/80",
    "dark:ring-muted-foreground/30",
    "dark:shadow-[0_1px_2px_rgba(15,23,42,0.65)]",
  ].join(" "),
  frosted: [
    "bg-muted/75",
    "text-foreground",
    "backdrop-blur-2xl",
    "ring-1",
    "ring-background/60",
    "shadow-[0_25px_55px_-20px_rgba(150,180,233,0.35)]",
    "dark:bg-muted/40",
    "dark:ring-secondary/10",
    "dark:shadow-[0_25px_55px_-20px_rgba(14,165,233,0.5)]",
  ].join(" "),
  soft: [
    "bg-gradient-to-br",
    "from-muted/60",
    "via-card",
    "to-muted",
    "text-card-foreground",
    "ring-1",
    "ring-border/70",
    "shadow-[0_12px_35px_-20px_rgba(15,23,42,0.35)]",
    "dark:from-card",
    "dark:via-card/70",
    "dark:to-card/40",
    "dark:ring-muted-foreground/30",
    "dark:shadow-[0_12px_35px_-18px_rgba(15,23,42,0.55)]",
  ].join(" "),
  radiant: [
    "bg-gradient-to-r",
    "from-[color:color-mix(in_oklch,_var(--color-primary)_10%,_var(--color-background))]",
    "via-[color:color-mix(in_oklch,_var(--color-primary)_5%,_var(--color-card))]",
    "to-[color:color-mix(in_oklch,_var(--color-secondary)_10%,_var(--color-background))]",
    "text-[color:var(--color-foreground)]",
    "ring-1",
    "ring-[color:color-mix(in_oklch,_var(--color-primary)_16%,_transparent)]",
    "shadow-[0_25px_50px_-20px_color-mix(in_oklch,_var(--color-primary)_20%,_transparent)]",
    "dark:from-[color:color-mix(in_oklch,_var(--color-primary)_12%,_var(--color-background))]",
    "dark:via-[color:color-mix(in_oklch,_var(--color-primary)_7%,_var(--color-card))]",
    "dark:to-[color:color-mix(in_oklch,_var(--color-secondary)_10%,_var(--color-background))]",
    "dark:text-[color:var(--color-foreground)]",
    "dark:ring-[color:color-mix(in_oklch,_var(--color-primary)_22%,_transparent)]",
    "dark:shadow-[0_25px_50px_-20px_color-mix(in_oklch,_var(--color-primary)_28%,_transparent)]",
  ].join(" "),
} as const;
