// entities/ の小さなファイル: form.ts（フォーム型）、firestore.ts（コレクション名）、index.ts（再エクスポート）

import { domainRel } from "../../domain/context.mjs";

/** entities/form.ts: Create / Update のフォーム型。Additional に手で項目を足す */
export function renderFormEntity(ctx) {
  const { camel, pascal } = ctx;
  let content = `// ${domainRel(ctx)}/entities/form.ts\n\n`;
  content += `import { z } from "zod";\n`;
  content += `import { ${pascal}CreateSchema, ${pascal}UpdateSchema } from "./schema";\n\n`;
  content += `export type ${pascal}CreateAdditional = {\n  // foo: string; フォームに追加する項目\n};\n`;
  content += `export type ${pascal}CreateFields = z.infer<typeof ${pascal}CreateSchema> & ${pascal}CreateAdditional;\n\n`;
  content += `export type ${pascal}UpdateAdditional = {\n  // foo: string; フォームに追加する項目\n};\n`;
  content += `export type ${pascal}UpdateFields = z.infer<typeof ${pascal}UpdateSchema> & ${pascal}UpdateAdditional;\n`;
  return content;
}

/** entities/<登録名>/firestore.ts: コレクションパス <登録名>CollectionPath（entity.json の plural、無ければ <snake>s。名前に登録名 = 集める入口で並べても重ならない、D344） */
export function renderFirestoreEntity(ctx) {
  const { camel, pluralRaw } = ctx;
  return `// ${domainRel(ctx)}/entities/firestore.ts\n\nexport const ${camel}CollectionPath = "${pluralRaw}";\n`;
}

/** entities/index.ts: model / drizzle|firestore / schema / form の再エクスポート */
export function renderEntityIndex(ctx) {
  const { camel, dbEngine } = ctx;
  const lines = [`// ${domainRel(ctx)}/entities/index.ts`, ""];
  lines.push('export * from "./model";');
  lines.push(dbEngine === "Firestore" ? 'export * from "./firestore";' : 'export * from "./drizzle";');
  lines.push('export * from "./schema";');
  lines.push('export * from "./form";');
  return `${lines.join("\n")}\n`;
}
