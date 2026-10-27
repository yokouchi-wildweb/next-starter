// dc:init: 質問に答えて src/features/<camel>/domain.json を新規作成する

import fs from "node:fs";
import askName from "../questions/name.mjs";
import askBasics from "../questions/basics.mjs";
import askRelations from "../questions/relations.mjs";
import askBaseFields from "../questions/base-fields.mjs";
import askNameField from "../questions/name-field.mjs";
import askFields from "../questions/fields/index.mjs";
import askCompositeUniques from "../questions/composite-uniques.mjs";
import askViewConfig from "../questions/view-config.mjs";
import askApiAccess from "../questions/api-access.mjs";
import askGenerateFiles from "../questions/generate-files.mjs";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";
import formatDomainConfig from "../spec/format.mjs";
import { DOMAIN_CONFIG_VERSION } from "../spec/version.mjs";

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @returns {Promise<string>} 作ったドメインの singular
 */
export async function runInit(workspace) {
  const config = {};
  config.domainConfigVersion = DOMAIN_CONFIG_VERSION;
  Object.assign(config, await askName());
  Object.assign(config, await askBasics());
  Object.assign(config, await askRelations(config));
  Object.assign(config, await askBaseFields());
  const { nameFieldEntry } = await askNameField(config);
  const { fields } = await askFields(config);
  config.fields = nameFieldEntry ? [nameFieldEntry, ...fields] : fields;
  Object.assign(config, await askCompositeUniques(config));
  Object.assign(config, await askViewConfig(config));
  Object.assign(config, await askApiAccess());
  Object.assign(config, await askGenerateFiles());

  const featureDir = toCamelCase(config.singular) || config.singular;
  const dir = workspace.featurePath(featureDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = workspace.configPath(featureDir);
  fs.writeFileSync(file, formatDomainConfig(config));
  console.log(`設定ファイルを作成しました: ${file}`);
  return config.singular;
}
