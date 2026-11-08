// src/lib/drizzle/transaction.ts
// 中身は入口(./index.ts)へ移した。外からは @/lib/drizzle だけを読む(package.json の exports)。
// このファイルは古い指定子 @/lib/drizzle/transaction を codemod が入口へ書き換えるための印として残す
// (fork は上流を merge してから pnpm check lib-package -- codemod --apply を回す。codemod は中のファイルの re-export を辿って入口を求める)

export { runWithTransaction, type TransactionClient } from "./index";
