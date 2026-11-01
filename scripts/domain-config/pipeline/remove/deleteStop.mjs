// dc:delete を止める判定: 主と従属の組を壊す削除と、他のドメインの domain.json から関連で指されているドメインの削除を止める。
// 読むだけで何も消さない。消すドメイン自身の関連（外向き）は数えない。指されたまま消すと、参照元の生成物が消えたドメインを import し続け、後で tsc / db:push が離れた場所で落ちる

import { toCamelCase } from "../../../../src/utils/stringCase.mjs";
import { resolvePairs } from "../pairs.mjs";

/** 指されていれば止める関連の種類。belongsToMany は includeRelationTable: false の逆側も含む（生成物が相手を import する） */
const REFERENCE_TYPES = new Set(["belongsTo", "belongsToMany", "hasMany", "hasOne"]);

/**
 * ドメインを指している関連の一覧（自己参照は除く）。ファイルを読まない純関数
 * @param {Map<string, object | null>} configs フォルダ名 → domain.json の中身（読めなければ null）
 * @param {string} folder 消すドメインのフォルダ名（camelCase）
 * @returns {{ domain: string, fieldName: string | undefined, relationType: string }[]}
 */
export function inboundReferences(configs, folder) {
  const references = [];
  for (const [domain, config] of configs) {
    if (domain === folder) continue;
    for (const relation of config?.relations ?? []) {
      if (!REFERENCE_TYPES.has(relation?.relationType) || toCamelCase(relation.domain) !== folder) continue;
      references.push({ domain, fieldName: relation.fieldName, relationType: relation.relationType });
    }
  }
  return references;
}

/** 組を壊す削除の理由（無ければ message: null）と、文面に出した残っている従属（remaining）を返す */
function pairStop(workspace, folder, pairs) {
  // 主: domain.json が残っている従属があれば止める（まだ書き出していない従属は残っていない）
  const remaining = (pairs.childrenOf.get(folder) ?? []).filter((child) => workspace.exists(workspace.configPath(child)));
  if (remaining.length > 0) {
    const fields = remaining.map((child) => `"${pairs.fieldOf.get(child)}"`).join(", ");
    return {
      remaining,
      message:
        `${folder} は集まりの従属（${remaining.join(", ")}）を持っているため削除できません。` +
        `消すなら、先に ${folder}/domain.json の集まりの項目 ${fields} を外し、従属を dc:delete --remove-config してから ${folder} を消してください`,
    };
  }
  // 従属: 主が集まりの項目を宣言している間は止める（残すと次の生成で雛形がまた書き出される）
  const owner = pairs.ownerOf.get(folder);
  if (owner) {
    return { remaining, message: `${folder} は ${owner} の集まりの従属です。先に ${owner}/domain.json の集まりの項目 "${pairs.fieldOf.get(folder)}" を外してください` };
  }
  return { remaining, message: null };
}

/**
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @param {string} folder 消すドメインのフォルダ名（camelCase）
 * @param {import("../pairs.mjs").PairIndex} [pairs]
 * @returns {string | null} 止める理由（null = 止めない）
 */
export function deleteStopMessage(workspace, folder, pairs = resolvePairs(workspace)) {
  const { remaining, message } = pairStop(workspace, folder, pairs);
  const configs = new Map(workspace.listDomains().map((domain) => [domain, workspace.readConfigLenient(workspace.configPath(domain))]));
  // 組の文面に出した従属は重ねて出さない（直すものは 1 回の実行で全部見せる）
  const references = inboundReferences(configs, folder).filter((reference) => !remaining.includes(reference.domain));
  const lines = message ? [message] : [];
  if (references.length > 0) {
    lines.push(
      `${folder} は他のドメインから参照されているため削除できません:`,
      ...references.map(({ domain, fieldName, relationType }) => `  - ${domain}: ${fieldName ?? "(fieldName なし)"}（${relationType}）`),
      "消すなら、先に参照元の domain.json からその関連を外すか、参照元を dc:delete --remove-config してください（domain.json を残すと宣言が残るので止まり続けます）",
    );
  }
  return lines.length > 0 ? lines.join("\n") : null;
}
