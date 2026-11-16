// scripts/structure/styles/generate.ts — 門の入口(pnpm generate styles): グラデーションの CSS・メールの色・余白の段の class の表を作り直す
void import("./generate-gradient-css")
  .then(() => import("./generate-mail-colors"))
  .then(() => import("./generate-spacing-classes"));
