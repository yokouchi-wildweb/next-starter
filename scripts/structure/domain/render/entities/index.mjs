// 生成カテゴリ entities: 登録のフォルダ entities/<登録名>/{model,form,schema}.ts と、Neon は drizzle.ts・Firestore は firestore.ts(D335・D336)、
// ドメインの entities/index.ts。集める入口 entities/<種類>.ts は pnpm generate registry が全ドメインに書く

import path from "node:path";
import { domainRel, requireConfig } from "../../domain/context.mjs";
import { file } from "../output.mjs";
import { entityKindsOf, moveIntoRegistration } from "./collector.mjs";
import { renderDrizzleEntity } from "./drizzle/index.mjs";
import { hasTableShape } from "./drizzle/shape.mjs";
import { renderModel } from "./model.mjs";
import { renderSchema } from "./schema.mjs";
import { renderEntityIndex, renderFirestoreEntity, renderFormEntity } from "./small.mjs";

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../output.mjs").Output[]}
 */
export function renderEntities(ctx, workspace) {
  requireConfig(ctx);
  const out = (name) => path.join(ctx.dir, "entities", name);
  if (ctx.dbEngine === "Firestore" && hasTableShape(ctx.config)) {
    throw new Error(`エラー: ${ctx.camel} は Firestore です。表の形の鍵(table・primaryKey・foreignKeys・checks・enums・dbObjects・fields[].column)は Neon だけ`);
  }
  // Neon も Firestore も登録のフォルダ entities/<登録名>/ に書く(登録の多いドメインでも同じ形)。集める入口 entities/<種類>.ts は pnpm generate registry
  const rel = domainRel(ctx);
  const registration = ctx.camel;
  const kinds = entityKindsOf(ctx.dbEngine);
  const texts = { model: renderModel(ctx), form: renderFormEntity(ctx), schema: renderSchema(ctx) };
  if (kinds.includes("drizzle")) texts.drizzle = renderDrizzleEntity(ctx, workspace);
  if (kinds.includes("firestore")) texts.firestore = renderFirestoreEntity(ctx);
  const labels = { model: "モデルエンティティ", form: "フォームエンティティ", drizzle: "Drizzle エンティティ", firestore: "Firestore エンティティ", schema: "スキーマ" };
  const outputs = [];
  for (const kind of kinds) {
    const text = moveIntoRegistration(texts[kind], { domainRel: rel, registration, kind, siblings: kinds });
    outputs.push(file(out(path.join(registration, `${kind}.ts`)), text, { label: `${labels[kind]}を生成しました` }));
  }
  outputs.push(file(out("index.ts"), renderEntityIndex(ctx), { label: "エンティティ索引を生成しました" }));
  return outputs;
}
