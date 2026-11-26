// 生成物・編集不可: pnpm generate registry が src/domains/core/userGroup/entities/*/schema.ts の並びから生成する
// src/domains/core/userGroup/entities/schema.ts
// 登録ごとのフォルダ(entities/<登録名>/schema.ts)を集めるだけの入口(import の道を変えないため)。中身は各登録のフォルダに書く

export * from "./userGroup/schema";
export * from "./userGroupDefinition/schema";
export * from "./userGroupVersion/schema";
