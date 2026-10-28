// 主の集まりの項目（mediaCollection）ごとに、従属ドメインの domain.json を無いときだけ書き出す（write-once。既にあれば触らない）。
// 生成カテゴリではなく主の宣言なので、generateFiles・--only に関わらず出す。
// drizzleBase.ts を手書きする主（generateFiles.serverServices: false）には、collections.ts を渡す 1 行を毎回案内する

import { isCollectionFieldType } from "../../spec/fieldTypes.mjs";
import formatDomainConfig from "../../spec/format.mjs";
import { toCamelCase } from "../../../../src/utils/stringCase.mjs";
import { log, writeOnce } from "../output.mjs";
import { buildChildDomainConfig } from "./childDomainConfig.mjs";

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../output.mjs").Output[]}
 */
export function renderChildDomainConfigs(ctx, workspace) {
  const outputs = [];
  // drizzleBase.ts を手書きする主は、生成の collections.ts を自分で渡す（ファイルは読まず毎回案内する）
  const owns = (ctx.config?.fields ?? []).some((field) => isCollectionFieldType(field.fieldType));
  if (owns && ctx.config?.generateFiles?.serverServices === false) {
    outputs.push(
      log(
        `  ※ [${ctx.camel}] drizzleBase.ts は手書き（generateFiles.serverServices: false）です。` +
          `${ctx.camel}/services/server/drizzleBase.ts に import { collections } from "./collections" を足し、createCrudService の options に collections を渡してください`,
      ),
    );
  }
  for (const field of ctx.config?.fields ?? []) {
    if (!isCollectionFieldType(field.fieldType) || typeof field.collection?.domain !== "string") continue;
    const { config, uncopied } = buildChildDomainConfig(ctx.config, field);
    const childPath = workspace.configPath(toCamelCase(config.singular));
    outputs.push(
      writeOnce(childPath, formatDomainConfig(config), {
        label: `[${ctx.camel}] 集まり ${field.name} の従属の domain.json を書き出しました`,
        keptLabel: `[${ctx.camel}] 集まり ${field.name} の従属の domain.json は既にあるため書きません`,
      }),
    );
    // 既にある従属は書かないので、写せなかった権限の案内も出さない（その domain.json が正）
    if (uncopied.length > 0 && !workspace.exists(childPath)) {
      const keys = uncopied.map((key) => `storage.${key}`).join(" / ");
      outputs.push(
        log(
          `  ※ [${ctx.camel}] 主の汎用 API の規則を写せない（閉じている・custom・手書きの domainEntry）ため、従属の ${keys} を管理者のみにしました。` +
            `直す場所: ${childPath} の fields "file" の ${keys}`,
        ),
      );
    }
  }
  return outputs;
}
