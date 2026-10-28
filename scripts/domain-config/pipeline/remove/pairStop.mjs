// dc:delete を止める判定: 主と従属の組（主の集まりの項目 mediaCollection → 従属ドメイン）を壊す削除だけを止める。
// 読むだけで何も消さない。集まりでない belongsTo で指されていても止めない（組でない参照は今までどおり人の判断）

import { resolvePairs } from "../pairs.mjs";

/**
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @param {string} folder 消すドメインのフォルダ名（camelCase）
 * @param {import("../pairs.mjs").PairIndex} [pairs]
 * @returns {string | null} 止める理由（null = 止めない）
 */
export function deleteStopMessage(workspace, folder, pairs = resolvePairs(workspace)) {
  // 主: domain.json が残っている従属があれば止める（まだ書き出していない従属は残っていない）
  const remaining = (pairs.childrenOf.get(folder) ?? []).filter((child) => workspace.exists(workspace.configPath(child)));
  if (remaining.length > 0) {
    const fields = remaining.map((child) => `"${pairs.fieldOf.get(child)}"`).join(", ");
    return (
      `${folder} は集まりの従属（${remaining.join(", ")}）を持っているため削除できません。` +
      `消すなら、先に ${folder}/domain.json の集まりの項目 ${fields} を外し、従属を dc:delete してから ${folder} を消してください`
    );
  }
  // 従属: 主が集まりの項目を宣言している間は止める（残すと次の生成で雛形がまた書き出される）
  const owner = pairs.ownerOf.get(folder);
  if (owner) {
    return `${folder} は ${owner} の集まりの従属です。先に ${owner}/domain.json の集まりの項目 "${pairs.fieldOf.get(folder)}" を外してください`;
  }
  return null;
}
