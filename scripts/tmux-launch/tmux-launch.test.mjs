// scripts/tmux-launch/tmux-launch.test.mjs
//
// 印の塊の出し入れ、HOME を一時フォルダにした setup の通し(入れる → 確かめる → もう一度 → 外す)、
// シェル関数の振り分け(偽の tmux / claude を PATH に置いて、何が呼ばれたかを見る)。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { BLOCK_START, hasBlock, parseVersion, removeBlock, upsertBlock } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const temps = [];
const temp = (prefix) => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  temps.push(dir);
  return dir;
};
after(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

test("upsertBlock / removeBlock: 足す・差し替える・外すと元に戻る", () => {
  const original = "alias C='claude'\n";
  const once = upsertBlock(original, "line 1");
  assert.equal(hasBlock(once), true);
  assert.equal(upsertBlock(once, "line 1"), once);
  const replaced = upsertBlock(once, "line 2");
  assert.match(replaced, /line 2/);
  assert.doesNotMatch(replaced, /line 1/);
  assert.equal(replaced.split(BLOCK_START).length, 2);
  assert.equal(removeBlock(replaced), original);
  assert.equal(removeBlock(upsertBlock("", "x")), "");
});

test("parseVersion", () => {
  assert.equal(parseVersion("# x\nNEXT_STARTER_CLAUDE_TMUX_VERSION=3\n"), 3);
  assert.equal(parseVersion(null), null);
});

const hasTmux = spawnSync("tmux", ["-V"], { stdio: "ignore" }).status === 0;

test("setup の通し: 入れる → --check が通る → もう一度でも重ならない → 外すと元に戻る", { skip: !hasTmux && "tmux が無い" }, () => {
  const home = temp("tmux-launch-home-");
  writeFileSync(path.join(home, ".bashrc"), "# mine\n");
  // TMUX_TMPDIR も一時フォルダに: setup の source-file がこのマシンの tmux サーバーに届かないように
  const env = { ...process.env, HOME: home, SHELL: "/bin/bash", XDG_DATA_HOME: "", TMUX_TMPDIR: home };
  const setup = (...args) => spawnSync("node", [path.join(here, "setup.mjs"), ...args], { env, encoding: "utf8" });

  assert.equal(setup("--check").status, 1);
  const installed = setup();
  assert.equal(installed.status, 0, installed.stderr);
  assert.match(installed.stdout, /シェルの設定に足しました/);
  assert.match(installed.stdout, /tmux の設定に足しました/);
  assert.equal(setup("--check").status, 0);
  setup();
  const rc = readFileSync(path.join(home, ".bashrc"), "utf8");
  assert.equal(rc.split(BLOCK_START).length, 2);
  assert.match(rc, /\.local\/share\/next-starter\/claude-tmux\.sh/);
  assert.match(readFileSync(path.join(home, ".tmux.conf"), "utf8"), /extended-keys on/);

  // 書いた ~/.tmux.conf を専用の tmux サーバーに読ませ、この版の tmux でもエラーが出ないこと
  // (3.2a は allow-passthrough を知らない。-q が無いとサーバーの起動時に最初のタブへエラーが重なって出る)
  const socket = `tmux-launch-conf-${process.pid}`;
  spawnSync("tmux", ["-L", socket, "-f", "/dev/null", "new-session", "-d", "-s", "c", "sleep 30"], { env, stdio: "ignore" });
  const loaded = spawnSync("tmux", ["-L", socket, "source-file", path.join(home, ".tmux.conf")], { env, encoding: "utf8" });
  spawnSync("tmux", ["-L", socket, "kill-server"], { env, stdio: "ignore" });
  assert.equal(loaded.status, 0, loaded.stderr);
  assert.equal(loaded.stderr.trim(), "");

  // 古い中身の塊(前の版の allow-passthrough に -q が無いもの)は「古い」と出て、入れ直すと書き換わる
  const confPath = path.join(home, ".tmux.conf");
  writeFileSync(confPath, upsertBlock("", "set -g allow-passthrough on"));
  const stale = setup("--check");
  assert.equal(stale.status, 1);
  assert.match(stale.stdout, /tmux の設定: 古い/);
  assert.match(setup().stdout, /tmux の設定の塊を書き直しました/);
  assert.match(readFileSync(confPath, "utf8"), /set -gq allow-passthrough on/);
  assert.doesNotMatch(readFileSync(confPath, "utf8"), /set -g allow-passthrough on/);
  assert.equal(setup("--check").status, 0);

  assert.equal(setup("--remove").status, 0);
  assert.equal(readFileSync(path.join(home, ".bashrc"), "utf8"), "# mine\n");
  assert.equal(readFileSync(path.join(home, ".tmux.conf"), "utf8"), "");
  assert.equal(setup("--check").status, 1);
});

/** 偽の tmux / claude を置き、シェル関数 claude を呼んだときの記録を返す */
const runShim = ({ cwd, args = [], env = {} }) => {
  const bin = temp("tmux-launch-bin-");
  const log = path.join(bin, "log");
  for (const name of ["tmux", "claude"]) {
    writeFileSync(path.join(bin, name), `#!/usr/bin/env bash\necho "${name} $*" >> ${JSON.stringify(log)}\n[ "$1" = has-session ] && exit 1\nexit 0\n`);
    chmodSync(path.join(bin, name), 0o755);
  }
  const quoted = args.map((a) => `'${a}'`).join(" ");
  const result = spawnSync("bash", ["-c", `. ${JSON.stringify(path.join(here, "claude-tmux.sh"))}; claude ${quoted}`], {
    cwd,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMUX: "", NO_TMUX_LAUNCH: "", CLAUDE_TMUX_ASSUME_TTY: "1", ...env },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  try {
    return readFileSync(log, "utf8");
  } catch {
    return "";
  }
};

test("シェル関数: 目印のあるリポでは tmux のセッションを作り、それ以外はそのまま claude", () => {
  const repo = temp("tmux-launch-repo-");
  mkdirSync(path.join(repo, ".claude"));
  writeFileSync(path.join(repo, ".claude/tmux-launch"), "");
  mkdirSync(path.join(repo, "src"));

  const inRepo = runShim({ cwd: path.join(repo, "src"), args: ["--continue"] });
  assert.match(inRepo, /^tmux new-session -s tmux-launch-repo-\S+ -c \S+\/src bash .*claude-tmux\.sh run \S+ --continue/m);
  assert.doesNotMatch(inRepo, /^claude /m);

  const other = temp("tmux-launch-other-");
  assert.match(runShim({ cwd: other }), /^claude $/m);
  assert.match(runShim({ cwd: repo, args: ["-p", "hi"] }), /^claude -p hi$/m);
  assert.match(runShim({ cwd: repo, args: ["mcp", "list"] }), /^claude mcp list$/m);
  assert.match(runShim({ cwd: repo, env: { TMUX: "/tmp/x,1,0" } }), /^claude $/m);
  assert.match(runShim({ cwd: repo, env: { NO_TMUX_LAUNCH: "1" } }), /^claude $/m);
});

test("タブの中(run): claude が終わり、ほかに claude のタブが無ければ、そのセッションの dev:tab を止める", { skip: !hasTmux && "tmux が無い" }, async () => {
  const repo = temp("tmux-launch-run-");
  const bin = temp("tmux-launch-runbin-");
  const log = path.join(bin, "log");
  for (const name of ["claude", "pnpm"]) {
    writeFileSync(path.join(bin, name), `#!/usr/bin/env bash\necho "${name} $*" >> ${JSON.stringify(log)}\n`);
    chmodSync(path.join(bin, name), 0o755);
  }
  const socket = `tmux-launch-test-${process.pid}`;
  mkdirSync(path.join(repo, ".agent"));
  writeFileSync(path.join(repo, ".agent/dev-tab.json"), JSON.stringify({ session: "s1" }, null, 2));
  const shim = path.join(here, "claude-tmux.sh");
  const tmuxCmd = (...args) => spawnSync("tmux", ["-L", socket, ...args], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  try {
    tmuxCmd("new-session", "-d", "-s", "s1", "-c", repo, `bash ${shim} run ${repo} --continue; sleep 5`);
    for (let i = 0; i < 50; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        if (/pnpm/.test(readFileSync(log, "utf8"))) break;
      } catch {
        // まだ
      }
    }
    const text = readFileSync(log, "utf8");
    assert.match(text, /^claude --continue$/m);
    assert.match(text, /^pnpm -s dev:tab stop$/m);
  } finally {
    tmuxCmd("kill-server");
  }
});
