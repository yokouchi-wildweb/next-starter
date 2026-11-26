// 生成物・編集不可: pnpm generate registry が src/domains/core/chatRoom/entities/*/firestore.ts の並びから生成する
// src/domains/core/chatRoom/entities/firestore.ts
// 登録ごとのフォルダ(entities/<登録名>/firestore.ts)を集めるだけの入口(import の道を変えないため)。中身は各登録のフォルダに書く

export * from "./chatRoom/firestore";
