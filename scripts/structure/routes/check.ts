// scripts/structure/routes/check.ts — 門の入口(pnpm check routes [-- show <引数>])
//   引数なし = ルート地図が生成結果と一致するか(map.mjs --check)
//   show [<URL>] [--view= --scope= --access= --state= --file=] = 地図を絞り込んで描く(map.mjs show。-- show --help)
// map.mjs は tsx(+ server-only の下駄)で動くので、門のランナーが tsx で起動する .ts の薄い入口にする
if (!process.argv.slice(2).includes("show")) process.argv.splice(2, 0, "--check");
void import("./map.mjs");
