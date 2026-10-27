// dc:add <Domain>: 既存の domain.json の fields 末尾に、対話でフィールドを足す（ファイルは生成しない）

import fs from "node:fs";
import askFields from "../questions/fields/index.mjs";
import formatDomainConfig from "../spec/format.mjs";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string | undefined} domain
 */
export async function runAddField(workspace, domain) {
  if (!domain) {
    console.error("使い方: pnpm dc:add <Domain>");
    process.exit(1);
  }
  const featureDir = toCamelCase(domain) || domain;
  const configPath = workspace.configPath(featureDir);
  if (!fs.existsSync(configPath)) {
    console.error(`domain.json が見つかりません: ${configPath}`);
    process.exit(1);
  }

  const currentConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const existingFields = Array.isArray(currentConfig.fields) ? currentConfig.fields : [];

  const addition = await askFields({ ...currentConfig, _fieldIndex: existingFields.length });
  const newFields = addition.fields ?? [];
  if (!newFields.length) {
    console.log("フィールドの追加は行われませんでした。");
    return;
  }

  const nextConfig = { ...currentConfig, fields: [...existingFields, ...newFields] };
  fs.writeFileSync(configPath, formatDomainConfig(nextConfig));
  console.log(`${newFields.length} 件のフィールドを ${configPath} へ追加しました。`);
}
