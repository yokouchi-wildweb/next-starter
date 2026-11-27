// 生成物・編集不可: pnpm generate registry が src/domains/sample/entities/*/form.ts の並びから生成する
// src/domains/sample/entities/form.ts
// 登録ごとのフォルダ(entities/<登録名>/form.ts)を集めるだけの入口(import の道を変えないため)。中身は各登録のフォルダに書く

export * from "./sample/form";
export * from "./sampleImage/form";
export * from "./sampleToSampleTag/form";
