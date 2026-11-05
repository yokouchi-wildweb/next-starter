// scripts/structure/routes/check.ts — 門の入口(pnpm check routes): ルート地図が生成結果と一致するか(= pnpm routes:map --check)
// map.mjs は tsx(+ server-only の下駄)で動くので、門のランナーが tsx で起動する .ts の薄い入口にする
process.argv.splice(2, 0, "--check");
void import("./map.mjs");
