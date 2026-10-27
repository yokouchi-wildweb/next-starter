// drizzleBase.ts / firestoreBase.ts テンプレートの、ドメインの形に応じた差し込みと削り: storage binding と空スキーマ

import { belongsToManyRelations, belongsToRelations } from "../../domain/relations.mjs";

export function buildStorageBindingImport(mediaFields) {
  if (mediaFields.length === 0) return "";
  return 'import { storageBindingFor } from "@/features/core/storageObject/services/server/crudBinding";\n';
}

/**
 * createCrudService に渡す storage binding（メディア列 ↔ ファイル台帳）。
 * purpose は registry の AUTO 登録と同じ `<camel>.<field>`。メディア列が無ければ何も出さない
 */
export function buildStorageBindingOption(camel, mediaFields) {
  if (mediaFields.length === 0) return "";
  const entries = mediaFields.map((f) => `    { name: "${f.name}", purpose: "${camel}.${f.name}", multi: ${f.multi} },`).join("\n");
  return [
    "  // メディア列の値（storage ref）をファイル台帳に紐付ける。複製・物理削除時のファイル処理もここで行う",
    `  storage: storageBindingFor("${camel}", [`,
    entries,
    "  ]),",
    "",
  ].join("\n");
}

/** CreateSchema が空になるか（全フィールドが formInput: "none" かつ belongsTo / belongsToMany が無い） */
export function hasEmptyCreateSchema(config) {
  if (!config) return false;
  if (belongsToRelations(config).length > 0) return false;
  if (belongsToManyRelations(config).length > 0) return false;
  return !(config.fields || []).some((f) => f.formInput !== "none");
}

const PARSE_LINES = [
  /  parseCreate: \(data\) => \w+CreateSchema\.parse\(data\),\n/g,
  /  parseUpdate: \(data\) => \w+UpdateSchema\.parse\(data\),\n/g,
  /  parseUpsert: \(data\) => \w+CreateSchema\.parse\(data\),\n/g,
];

/** 空スキーマ時: drizzleBase テンプレートから parse / satisfies / 不要 import を除く */
export function stripDrizzleBaseForEmptySchema(content) {
  content = content.replace(/import \{ \w+CreateSchema, \w+UpdateSchema \} from [^\n]+;\n/, "");
  content = content.replace(/import type \{ z \} from "zod";\n/, "");
  content = content.replace(/import type \{ DrizzleCrudServiceOptions \} from [^\n]+;\n/, "");
  content = content.replace(/\} satisfies DrizzleCrudServiceOptions<\n\s*z\.infer<typeof \w+CreateSchema>\n>;/, "};");
  for (const pattern of PARSE_LINES) content = content.replace(pattern, "");
  return content;
}

/** 空スキーマ時: firestoreBase テンプレートから parse / 不要 import を除く */
export function stripFirestoreBaseForEmptySchema(content) {
  content = content.replace(/import \{ \w+CreateSchema, \w+UpdateSchema \} from [^\n]+;\n/, "");
  for (const pattern of PARSE_LINES) content = content.replace(pattern, "");
  return content;
}
