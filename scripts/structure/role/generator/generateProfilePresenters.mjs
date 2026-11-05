// scripts/structure/role/generator/generateProfilePresenters.mjs
// entities/profiles/{roleId}/presenters.ts の生成

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase } from "../../../../src/utils/stringCase.mjs";
import { presenterFor } from "../../../../src/lib/domain/fields/presenterFor.mjs";
import { profileFileHeader } from "./header.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../../..");
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/entities/profiles"
);

const buildOptionsMap = (options = []) => {
  return options
    .map((opt) => `"${String(opt.value)}": "${opt.label ?? opt.value}"`)
    .join(", ");
};

const DATE_FORMATTER = (format) => `formatDateValue(value, "${format}", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null }))`;

/**
 * presenterFor の答えの種類 → プロフィールの presenters.ts の式（null = 項目を出さない）。
 * プロフィールはメディアの表示部品を読まないので、メディア・集まりの項目は出さない（今の生成物どおり）
 */
const FORMATTERS = {
  boolean: () => `formatBoolean(value, "はい", "いいえ")`,
  number: () => `formatNumber(value)`,
  stringArray: () => `formatStringArray(value)`,
  enum: (spec) => `formatEnumLabel(value, { ${buildOptionsMap(spec.options)} })`,
  string: () => `formatString(value)`,
  datetime: () => DATE_FORMATTER("YYYY/MM/DD HH:mm"),
  date: () => DATE_FORMATTER("YYYY/MM/DD"),
  collectionThumbnails: () => null,
  mediaThumbnail: () => null,
  mediaThumbnails: () => null,
};

// 何で表示するかは src/lib/domain/fields/presenterFor.mjs（ドメインの presenters 生成と同じ答え）
const buildFormatter = (field) => {
  const spec = presenterFor(field);
  return FORMATTERS[spec.kind](spec);
};

/**
 * entities/profiles/{roleId}/presenters.ts を生成
 */
export function generateProfilePresenters(roleConfig, profileConfig) {
  const roleId = roleConfig.id;
  const rolePascal = toPascalCase(roleId);

  const presenterEntries = (profileConfig.fields ?? [])
    .map((field) => {
      const formatter = buildFormatter(field);
      if (formatter === null) {
        return null;
      }
      const camelName = toCamelCase(field.name);
      return `  ${camelName}: ({ value }: { value: unknown }) => ${formatter},`;
    })
    .filter((entry) => entry !== null);

  const body = presenterEntries.length
    ? presenterEntries.join("\n")
    : "  // フィールドなし";

  const content = `${profileFileHeader(roleId)}
// src/features/core/userProfile/entities/profiles/${roleId}/presenters.ts
// ${roleConfig.label}プロフィールのプレゼンター
//
// 元情報: src/features/core/userProfile/profiles/${roleId}.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import {
  formatBoolean,
  formatDateValue,
  formatEnumLabel,
  formatNumber,
  formatString,
  formatStringArray,
} from "@/lib/crud/presenters";
import { formatDateJa } from "@/utils/date";

/**
 * ${roleConfig.label}プロフィールのプレゼンター
 */
export const ${toCamelCase(roleId)}ProfilePresenters = {
${body}
};
`;

  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "presenters.ts");
  fs.writeFileSync(filePath, content);
}
