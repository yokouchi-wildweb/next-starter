// entities/ の小さなファイル: form.ts（フォーム型）、firestore.ts（コレクション名）、index.ts（再エクスポート）

/** entities/form.ts: Create / Update のフォーム型。Additional に手で項目を足す */
export function renderFormEntity(ctx) {
  const { camel, pascal } = ctx;
  let content = `// src/features/${camel}/entities/form.ts\n\n`;
  content += `import { z } from "zod";\n`;
  content += `import { ${pascal}CreateSchema, ${pascal}UpdateSchema } from "./schema";\n\n`;
  content += `export type ${pascal}CreateAdditional = {\n  // foo: string; フォームに追加する項目\n};\n`;
  content += `export type ${pascal}CreateFields = z.infer<typeof ${pascal}CreateSchema> & ${pascal}CreateAdditional;\n\n`;
  content += `export type ${pascal}UpdateAdditional = {\n  // foo: string; フォームに追加する項目\n};\n`;
  content += `export type ${pascal}UpdateFields = z.infer<typeof ${pascal}UpdateSchema> & ${pascal}UpdateAdditional;\n`;
  return content;
}

/** entities/firestore.ts: コレクションパス（domain.json の plural、無ければ <snake>s） */
export function renderFirestoreEntity(ctx) {
  const { camel, pluralRaw } = ctx;
  return `// src/features/${camel}/entities/firestore.ts\n\nexport const collectionPath = "${pluralRaw}";\n`;
}

/** entities/index.ts: model / drizzle|firestore / schema / form の再エクスポート */
export function renderEntityIndex(ctx) {
  const { camel, dbEngine } = ctx;
  const lines = [`// src/features/${camel}/entities/index.ts`, ""];
  lines.push('export * from "./model";');
  lines.push(dbEngine === "Firestore" ? 'export * from "./firestore";' : 'export * from "./drizzle";');
  lines.push('export * from "./schema";');
  lines.push('export * from "./form";');
  return `${lines.join("\n")}\n`;
}
