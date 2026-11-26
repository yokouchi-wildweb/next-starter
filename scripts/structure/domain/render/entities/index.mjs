// 生成カテゴリ entities: Neon = 登録のフォルダ entities/<登録名>/{model,form,drizzle,schema}.ts(D335。生成するのは登録 1 つのドメインだけ =
// 登録名はドメイン名)と entities/index.ts。集める入口 entities/<種類>.ts は pnpm generate registry が全ドメインに書く。Firestore = entities/{model,form,firestore,schema,index}.ts

import path from "node:path";
import { domainRel, requireConfig } from "../../domain/context.mjs";
import { file } from "../output.mjs";
import { ENTITY_KINDS, moveIntoRegistration } from "./collector.mjs";
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
  if (ctx.dbEngine === "Firestore") {
    if (hasTableShape(ctx.config)) {
      throw new Error(`エラー: ${ctx.camel} は Firestore です。表の形の鍵(table・primaryKey・foreignKeys・checks・enums・dbObjects・fields[].column)は Neon だけ`);
    }
    return [
      file(out("model.ts"), renderModel(ctx), { label: "モデルエンティティを生成しました" }),
      file(out("form.ts"), renderFormEntity(ctx), { label: "フォームエンティティを生成しました" }),
      file(out("firestore.ts"), renderFirestoreEntity(ctx), { label: "Firestore エンティティを生成しました" }),
      file(out("schema.ts"), renderSchema(ctx), { label: "スキーマを生成しました" }),
      file(out("index.ts"), renderEntityIndex(ctx), { label: "エンティティ索引を生成しました" }),
    ];
  }
  const rel = domainRel(ctx);
  const registration = ctx.camel;
  const texts = { model: renderModel(ctx), form: renderFormEntity(ctx), drizzle: renderDrizzleEntity(ctx, workspace), schema: renderSchema(ctx) };
  const labels = { model: "モデルエンティティ", form: "フォームエンティティ", drizzle: "Drizzle エンティティ", schema: "スキーマ" };
  const outputs = [];
  for (const kind of ENTITY_KINDS) {
    const text = moveIntoRegistration(texts[kind], { domainRel: rel, registration, kind, siblings: ENTITY_KINDS });
    outputs.push(file(out(path.join(registration, `${kind}.ts`)), text, { label: `${labels[kind]}を生成しました` }));
  }
  outputs.push(file(out("index.ts"), renderEntityIndex(ctx), { label: "エンティティ索引を生成しました" }));
  return outputs;
}
