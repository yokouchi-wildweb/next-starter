// 生成物・編集不可: pnpm generate registry が src/domains/core/outbox/entities/*/model.ts の並びから生成する
// src/domains/core/outbox/entities/model.ts
// 登録ごとのフォルダ(entities/<登録名>/model.ts)を集めるだけの入口(import の道を変えないため)。中身は各登録のフォルダに書く

export * from "./outbox/model";
