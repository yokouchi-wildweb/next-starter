// scripts/workflow/repo-paths/lib.mjs — リポの名を付けたパスの判定(純関数)。入口は check.mjs、説明は README.md。
// 決まり: CLAUDE.md CHANGE_TYPES design_check(リポの名を付けた置き場は作らない)・core/ownership.md repo_records(D307・D308)

/**
 * repo_records の決まった所(リポ自身の記録。変更形式ではなく、置き場の手本にしない)
 * @type {readonly { glob: (id: string) => RegExp, what: string }[]}
 */
export const REPO_RECORD_PLACES = [
  { glob: (id) => new RegExp(`^\\.notices/applied/${escape(id)}\\.md$`), what: "取り込みの台帳 .notices/applied/<repo_id>.md" },
  { glob: (id) => new RegExp(`^\\.fork-ownership/${escape(id)}\\.permits\\.txt$`), what: "一時許可 .fork-ownership/<repo_id>.permits.txt" },
  { glob: (id) => new RegExp(`^docs/journal/\\d{4}-\\d{2}-\\d{2}--${escape(id)}--[^/]+\\.md$`), what: "日付の記録 docs/journal/<date>--<owner>--<slug>.md" },
];

function escape(/** @type {string} */ text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * パスの名前(ファイル名・フォルダ名)にリポの名が入るか: 段 = 名 / `<名>.…` / `….<名>.…` / `…--<名>--…`
 * @param {string} path
 * @param {string} id
 */
export function carriesRepoName(path, id) {
  const e = escape(id);
  const segment = new RegExp(`^(?:${e}(?:\\..*)?|.*\\.${e}\\..*|.*\\.${e}|.*--${e}--.*)$`);
  return path.split("/").some((part) => segment.test(part));
}

/**
 * repo_records の所の外でリポの名を持つパス
 * @param {string[]} paths 追跡中のパス(リポの根からの相対、/ 区切り)
 * @param {string[]} ids 見るリポの名(Tier1 = 自分の repo_id)
 * @returns {{ path: string, id: string }[]}
 */
export function repoNamedProblems(paths, ids) {
  const out = [];
  for (const path of paths) {
    for (const id of ids) {
      if (!carriesRepoName(path, id)) continue;
      if (REPO_RECORD_PLACES.some((place) => place.glob(id).test(path))) continue;
      out.push({ path, id });
    }
  }
  return out;
}
