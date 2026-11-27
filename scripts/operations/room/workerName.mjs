// scripts/operations/room/workerName.mjs
// ルームの Worker の名前の読み手(deploy・secret・init が同じ名前を使う)。名前 = room-server-<repo.json の repo_id>(D490 (2))。
// servers/room/wrangler.toml の name は使わない: fork が commit したそのファイルは下の段へ受け継がれ、その名前のまま出すと
// 親の本番の Worker を wrangler deploy が黙って置き換える。repo_id は祖先と同じだと読み手が誤りにするので、名前が親とぶつからない。
import { readForkIdentity } from "../../../src/lib/forkOwnership/node.mjs";

/**
 * @param {string} repoRoot
 * @returns {{ name: string, error?: undefined } | { error: string, name?: undefined }}
 */
export function roomWorkerName(repoRoot) {
  const identity = readForkIdentity(repoRoot);
  if (identity.errors.length > 0 || !identity.own) {
    return { error: `repo.json の repo_id が読めない(Worker の名前を作れない): ${identity.errors.join(" / ") || "repo_id が無い"}` };
  }
  return { name: `room-server-${identity.own}` };
}

/** wrangler.toml の name の行(無ければ null)。使わない値を知らせるためだけに読む */
export function tomlWorkerName(tomlText) {
  return /^name\s*=\s*"([^"]+)"/m.exec(tomlText)?.[1] ?? null;
}
