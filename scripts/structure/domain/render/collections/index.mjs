// 主の集まりの項目（mediaCollection）ごとに、従属ドメインの宣言(domain.json と entities/<従属>/entity.json)を無いときだけ書き出す
// （write-once。既にあれば触らない）。
// 生成カテゴリではなく主の宣言なので、--only に関わらず出す（主が generate: false なら plan が何も出さない）。
// 手で管理する主（generate: false）の <登録名>Base.ts が collections を渡し忘れたら pnpm test scripts/structure/registry/collectionWiring/collectionWiring.test.mjs が見つける

import { isCollectionFieldType } from "../../spec/fieldTypes.mjs";
import formatDomainConfig from "../../spec/format.mjs";
import { DOMAIN_CONFIG_VERSION } from "../../spec/version.mjs";
import { toCamelCase } from "../../../../../src/lib/stringCase/index.mjs";
import { log, writeOnce } from "../output.mjs";
import { buildChildDomainConfig } from "./childDomainConfig.mjs";

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../output.mjs").Output[]}
 */
export function renderChildDomainConfigs(ctx, workspace) {
  const outputs = [];
  for (const field of ctx.config?.fields ?? []) {
    if (!isCollectionFieldType(field.fieldType) || typeof field.collection?.domain !== "string") continue;
    const { config, uncopied } = buildChildDomainConfig(ctx.config, field);
    const childCamel = toCamelCase(config.singular);
    const childPath = workspace.configPath(childCamel);
    outputs.push(
      writeOnce(workspace.domainDeclarationPath(childCamel), formatDomainConfig({ domainConfigVersion: DOMAIN_CONFIG_VERSION, label: config.label }), {
        label: `[${ctx.camel}] 集まり ${field.name} の従属の domain.json を書き出しました`,
        keptLabel: `[${ctx.camel}] 集まり ${field.name} の従属の domain.json は既にあるため書きません`,
      }),
      writeOnce(childPath, formatDomainConfig(config), {
        label: `[${ctx.camel}] 集まり ${field.name} の従属の登録の entity.json を書き出しました`,
        keptLabel: `[${ctx.camel}] 集まり ${field.name} の従属の登録の entity.json は既にあるため書きません`,
      }),
    );
    // 既にある従属は書かないので、写せなかった権限の案内も出さない（その entity.json が正）
    if (uncopied.length > 0 && !workspace.exists(childPath)) {
      const keys = uncopied.map((key) => `storage.${key}`).join(" / ");
      outputs.push(
        log(
          `  ※ [${ctx.camel}] 主の汎用 API の規則を写せない（閉じている・custom・手で持つ登録 generate:false）ため、従属の ${keys} を管理者のみにしました。` +
            `直す場所: ${childPath} の fields "file" の ${keys}`,
        ),
      );
    }
  }
  return outputs;
}
