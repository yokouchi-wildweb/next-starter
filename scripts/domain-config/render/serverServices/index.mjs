// generateFiles.serverServices: services/server/{drizzleBase|firestoreBase}.ts（毎回）、<domain>Service.ts（write-once）、wrappers/.gitkeep
//
// <domain>Service.ts はラッパーや独自処理を組み込む手書きの場所なので再生成で上書きしない。
// dc:generate:service で明示的に選んだとき（overwriteService）だけ上書きする

import path from "node:path";
import { collectMediaFields } from "../../spec/fieldTypes.mjs";
import { dir, file, writeOnce } from "../output.mjs";
import { replaceDomainTokens } from "../tokens.mjs";
import { checkMediaFieldsEngine } from "../../checks/mediaEngine.mjs";
import { composeServiceOptions } from "./options.mjs";
import { buildEntityImports, buildRelationTableImports } from "./relations/imports.mjs";
import {
  buildStorageBindingImport,
  buildStorageBindingOption,
  hasEmptyCreateSchema,
  stripDrizzleBaseForEmptySchema,
  stripFirestoreBaseForEmptySchema,
} from "./templateTweaks.mjs";

/** 旧 wrappers/duplicate を組み込んだままの <domain>Service.ts への警告（複製は binding が担う） */
function legacyDuplicateWarning(ctx, serviceFileName) {
  return (existing) =>
    existing.includes("./wrappers/duplicate")
      ? [
          `[${ctx.camel}] ${serviceFileName} が wrappers/duplicate（旧ファイル複製）を組み込んでいます。` +
            `複製は drizzleBase の storage binding が行うため、\`import { duplicate } from "./wrappers/duplicate";\` と \`duplicate,\` を外してください` +
            `（残すと複製した旧 URL の保存が binding に拒否されます）。`,
        ]
      : [];
}

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @param {{ targets?: { base?: boolean, service?: boolean }, overwriteService?: boolean }} [options] targets 未指定 = 両方
 * @returns {import("../output.mjs").Output[]}
 */
export function renderServerServices(ctx, workspace, options = {}) {
  const { targets, overwriteService = false } = options;
  const generateBase = targets?.base ?? true;
  const generateService = targets?.service ?? true;
  const { config, camel, pascal, dbEngine } = ctx;

  const composed = config ? composeServiceOptions(workspace, config, pascal, camel) : null;
  const mediaFields = collectMediaFields(config);
  const isEmptyCreateSchema = hasEmptyCreateSchema(config);

  // Firestore: コレクションパスを firestore.ts の collectionPath と一致させる（__domains__ も同じ値にする）
  const tokenCtx = dbEngine === "Firestore" ? { ...ctx, camelPlural: ctx.pluralRaw } : ctx;

  // ファイル台帳との連動（storage binding）は Drizzle 専用。Firestore adapter は凍結のため、メディア列は生成エラーで止める
  const mediaEngineError = checkMediaFieldsEngine(camel, config, dbEngine);
  if (mediaEngineError) throw new Error(mediaEngineError);

  const baseFile = dbEngine === "Firestore" ? "firestoreBase.ts" : "drizzleBase.ts";
  const outputDir = path.join(ctx.dir, "services", "server");

  // ドメイン名のトークンは共通の置換（render/tokens.mjs）、サービス固有のトークンはここで
  const replaceTokens = (content) =>
    replaceDomainTokens(content, tokenCtx)
      .replace(/__serviceBase__/g, baseFile.replace(/\.ts$/, ""))
      .replace(/__serviceOptions__/g, composed?.optionsLiteral ?? "{}")
      .replace(/__DrizzleEntityImports__/g, buildEntityImports(pascal, composed?.relationTableImports ?? []))
      .replace(/__belongsToManyRelations__/g, composed?.belongsToManyLiteral ?? "")
      .replace(/__RelationTableImports__/g, buildRelationTableImports(composed?.relationDomainImports ?? [], camel))
      .replace(/__StorageBindingImport__/g, buildStorageBindingImport(mediaFields))
      .replace(/__storageBinding__/g, buildStorageBindingOption(camel, mediaFields));

  // wrappers/ が無ければ作って .gitkeep を置く（あれば中身に触らない）
  const outputs = [dir(path.join(outputDir, "wrappers"), { keepFile: ".gitkeep" })];

  if (generateBase) {
    let content = replaceTokens(workspace.readTemplate("services", "server", baseFile));
    // 全フィールドが formInput: "none" の場合、parse / satisfies を除去
    if (isEmptyCreateSchema) {
      content = baseFile === "drizzleBase.ts" ? stripDrizzleBaseForEmptySchema(content) : stripFirestoreBaseForEmptySchema(content);
    }
    outputs.push(file(path.join(outputDir, baseFile), content, { label: "サーバーサービスを生成しました" }));
  }

  if (generateService) {
    const serviceFileName = `${camel}Service.ts`;
    const content = replaceTokens(workspace.readTemplate("services", "server", "__domain__Service.ts"));
    const servicePath = path.join(outputDir, serviceFileName);
    outputs.push(
      overwriteService
        ? file(servicePath, content, { label: "サーバーサービスを生成しました" })
        : writeOnce(servicePath, content, {
            label: "サーバーサービスを生成しました",
            keptLabel: "既存のため生成しません（書き捨て）",
            warnOnKeep: mediaFields.length > 0 ? legacyDuplicateWarning(ctx, serviceFileName) : undefined,
          }),
    );
  }
  return outputs;
}
