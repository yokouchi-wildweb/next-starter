// src/lib/forkOwnership/testRepos.mjs — 所有の検査のテストの部品(一時の git リポジトリの親と fork を os.tmpdir に作る、ネットワーク不要)
// テストだけが読む(check.test.mjs と、生成器の側の scripts/structure/extensions/intakeOwnership.test.mjs)。
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const PARENT_ID = "parent";
export const FORK_ID = "child";

export const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
};
delete ENV.FORK_OWNERSHIP_PARENT;

export const git = (cwd, ...args) => execFileSync("git", args, { cwd, env: ENV, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

export const write = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

export const commitAll = (root, message) => {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
};

let tmp;
let counter = 0;

/** 一時の置き場を作る(テストの before で呼ぶ) */
export function openTmp() {
  tmp = mkdtempSync(join(tmpdir(), "fork-ownership-"));
  return tmp;
}

/** 今の一時の置き場 */
export const tmpRoot = () => tmp;

/** 一時のリポの名前の通し番号 */
export const nextId = () => (counter += 1);

/** 一時の置き場を消す(テストの after で呼ぶ) */
export function closeTmp() {
  rmSync(tmp, { recursive: true, force: true });
}

export const LINEAGE_PREAMBLE = "# lineage\n> **ROLE**: 中間層の規則\n<!-- end preamble -->\n";

/** 親(Tier1 役)を作る。withIntake: false = この検査を含まない版、withLineage = 前置きだけの lineage.md と append の受け口 */
export function makeParent({ withIntake = true, withLineage = false } = {}) {
  const root = join(tmp, `parent-${(counter += 1)}`);
  mkdirSync(root);
  git(root, "init", "-q", "-b", "main");
  git(root, "remote", "add", "origin", `git@github.com:acme/parent.git`);
  write(root, "src/lib/CATALOG.md", `# 目録\n\n## ${PARENT_ID}\n- src/lib/crud — CRUD\n`);
  write(root, ".claude/rules/project.md", `## TIER\nfork_id: ${PARENT_ID}\ndownstream: yes\n`);
  write(root, "src/lib/crud/index.ts", "export const crud = 1;\n");
  write(root, "src/config/app.config.ts", "export const app = { name: 'base' };\n");
  write(root, "src/features/core/user/user.ts", "export const user = 1;\n");
  write(root, ".notices/README.md", "# notices\n");
  write(root, ".notices/20260101-000000-inherited.md", "# DOWNSTREAM NOTICE id:20260101-000000-inherited\n");
  if (withIntake) {
    write(
      root,
      "src/lib/forkOwnership/intake.txt",
      `edit src/config/**  # 値\nappend src/lib/CATALOG.md  # 目録\nedit .claude/rules/project.md  # fork の名前の宣言\n${withLineage ? "append .claude/rules/lineage.md  # 中間層の節\n" : ""}`,
    );
  }
  if (withLineage) write(root, ".claude/rules/lineage.md", LINEAGE_PREAMBLE);
  commitAll(root, "base");
  return root;
}

/** 親を clone して fork を作る(親の remote = upstream、origin = acme/child、名前は project.md の fork_id: child) */
export function makeFork(parent) {
  const root = join(tmp, `fork-${(counter += 1)}`);
  git(tmp, "clone", "-q", parent, root);
  git(root, "remote", "rename", "origin", "upstream");
  git(root, "remote", "add", "origin", `git@github.com:acme/child.git`);
  write(root, "src/features/game/game.ts", "export const game = 1;\n");
  write(root, ".claude/rules/project.md", `## TIER\nfork_id: ${FORK_ID}\ndownstream: yes\n`);
  // 台帳の初めの行: 取り込んだ上流(Tier1)の版を upstream: に(D29)
  write(root, `.notices/applied/${FORK_ID}.md`, `# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | upstream:${git(root, "rev-parse", "upstream/main").trim()} | notes:-\n`);
  commitAll(root, "fork start");
  return root;
}

/** 台帳に 1 行足す(upstream: = 今取り込んだ親の版) */
export const recordLedger = (fork, id, ledger = FORK_ID) => {
  const path = `.notices/applied/${ledger}.md`;
  const current = readFileSync(join(fork, path), "utf8");
  write(fork, path, `${current}- id:${id} | date:x | commit:- | upstream:${git(fork, "rev-parse", "upstream/main").trim()} | notes:-\n`);
};
