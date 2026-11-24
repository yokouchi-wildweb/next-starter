// scripts/runner/phases/changed.mjs — 範囲の変更したファイルと glob(段階の watch と pnpm test --changed が共有する)
import { spawnSync } from "node:child_process";

/** watch の glob(** = 何段でも、* = 1 段の中、? = 1 文字)を正規表現に。リポジトリ直下からの相対パスに丸ごと当てる */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

const git = (repo, args) => {
  const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};

/**
 * 範囲の変更したファイル(リポジトリ直下からの相対)。範囲が決まらなければ { files: null, why }
 * - range なし = 比べる上流の枝との分岐点から HEAD まで + 作業ツリー + 未追跡(/sluice の検査の範囲)
 * - range = "<前>...<先>" = その 2 点の分岐点から <先> までの差分だけ(作業ツリー・未追跡は入れない)。/flux が取り込む区間の上流の差分を
 *   渡す口(D315)。--no-renames で改名は元(消した)と先(足した)の両方が載る(/flux 5d の許す集合と同じ読み方)
 */
export function changedFiles(repo, { range } = {}) {
  if (range !== undefined) {
    const list = git(repo, ["-c", "core.quotePath=false", "diff", "--no-renames", "--name-only", range]);
    if (list === null) return { files: null, why: `範囲 ${range} の差分が読めない` };
    return { files: list.split("\n").filter(Boolean), base: range };
  }
  const branch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const candidates = ["@{upstream}", branch && branch !== "HEAD" ? `origin/${branch}` : null, "origin/HEAD", "origin/main"].filter(Boolean);
  const base = candidates.find((ref) => git(repo, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]) !== null);
  if (!base) return { files: null, why: "比べる上流の枝が無い" };
  const lists = [["diff", "--name-only", `${base}...HEAD`], ["diff", "--name-only", "HEAD"], ["ls-files", "--others", "--exclude-standard"]].map((a) => git(repo, a));
  if (lists.some((l) => l === null)) return { files: null, why: "git の差分が読めない" };
  return { files: [...new Set(lists.flatMap((l) => l.split("\n").filter(Boolean)))], base };
}
