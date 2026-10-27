// generateFiles.entities: entities/{model,form,drizzle|firestore,schema,index}.ts

import path from "node:path";
import { requireConfig } from "../../domain/context.mjs";
import { file } from "../output.mjs";
import { renderDrizzleEntity } from "./drizzle/index.mjs";
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
  const outputs = [
    file(out("model.ts"), renderModel(ctx), { label: "モデルエンティティを生成しました" }),
    file(out("form.ts"), renderFormEntity(ctx), { label: "フォームエンティティを生成しました" }),
  ];
  if (ctx.dbEngine === "Firestore") {
    outputs.push(file(out("firestore.ts"), renderFirestoreEntity(ctx), { label: "Firestore エンティティを生成しました" }));
  } else {
    outputs.push(file(out("drizzle.ts"), renderDrizzleEntity(ctx, workspace), { label: "Drizzle エンティティを生成しました" }));
  }
  outputs.push(file(out("schema.ts"), renderSchema(ctx), { label: "スキーマを生成しました" }));
  outputs.push(file(out("index.ts"), renderEntityIndex(ctx), { label: "エンティティ索引を生成しました" }));
  return outputs;
}
