// scripts/structure/extensions/gate-check.mjs — 門の入口(pnpm check extensions): 受け口の宣言・項目・生成一覧の検査
// forge の事前検査(GATE=forge:pre)は生成の前なので一覧のずれを見ない(--no-stale、今の forge と同じ)
if (process.env.GATE === "forge:pre") process.argv.splice(2, 0, "--no-stale");
await import("./check.mjs");
