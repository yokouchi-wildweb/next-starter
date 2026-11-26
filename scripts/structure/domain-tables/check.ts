// scripts/structure/domain-tables/check.ts — pnpm check domain-tables の入口(段 ship)。
// 照らしは表の定義のファイル(.ts)を読み込む: 登録のフォルダをまたぐ表の import は tsconfig の paths(@/domains/…)で、表のファイルは
// server-only も読む。.ts の入口は段階の道具が tsx + server-only の下駄で起動する(scripts/runner/phases/run.mjs command)ので、その上でテストを回す
// 動的 import で ESM のまま読む(静的 import だと tsx がこの .ts と一緒に CJS へ組み直し、tables.mjs の import.meta.resolve が無くなる)
void import("./tables.test.mjs");
