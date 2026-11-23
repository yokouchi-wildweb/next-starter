// .notices/20261123-151428-root-files.forks.test.mjs
// 区切り root-files の fork の道具(20261123-151428-root-files.forks.mjs)。実行: pnpm test .notices/20261123-151428-root-files.forks.test.mjs
// 形は research の fork の差(TriQ の allowedDevOrigins と eslint の plugin、boardgame-site の Sentry の包み・.mcp.json の args・.gitignore の足し分)を写す

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";

import { MARKER, apply, plan, planEslint, planJson, planLineFile, planNext, planPlaywright, resolveRevs } from "./20261123-151428-root-files.forks.mjs";

const ONE_LINE_ESLINT = 'export { default } from "./eslint.config.core.mjs";\n';
const OLD_NEXT = [
  'import type { NextConfig } from "next";',
  "",
  "const buildId = crypto.randomUUID();",
  "",
  "const nextConfig: NextConfig = {",
  "  cacheComponents: true,",
  "  partialPrefetching: false,",
  "};",
  "",
  "export default nextConfig;",
  "",
].join("\n");

describe("eslint", () => {
  test("中身のある eslint.config.fork.mjs → 本体の後ろに足す版を書き、ファイルを消す", () => {
    const fork = ['import tokens from "./eslint-rules/style-tokens.mjs";', "", "const forkConfig = [", '  { files: ["src/x/**"], plugins: { t: tokens }, rules: { "t/a": "error" } },', "];", "", "export default forkConfig;", ""].join("\n");
    const steps = planEslint({ fork, plain: ONE_LINE_ESLINT, parentPlain: ONE_LINE_ESLINT });
    assert.deepEqual(steps.map((s) => `${s.action} ${s.path}`), ["write eslint.config.mjs", "remove eslint.config.fork.mjs"]);
    const content = steps[0].content ?? "";
    assert.match(content, /import core from "\.\/eslint\.config\.core\.mjs";/);
    assert.match(content, /import tokens from/);
    assert.match(content, /export default \[\.\.\.core, \.\.\.forkConfig\];/);
    assert.doesNotMatch(content, /export default forkConfig/);
  });

  test("空の雛形は消すだけ、export default の配列は名前を付けて足す、読めない形は止める", () => {
    const empty = "/** @type {any[]} */\nconst forkConfig = [];\n\nexport default forkConfig;\n";
    assert.deepEqual(planEslint({ fork: empty, plain: ONE_LINE_ESLINT, parentPlain: ONE_LINE_ESLINT }).map((s) => s.action), ["remove"]);
    const literal = planEslint({ fork: 'export default [\n  { rules: { "no-x": "error" } },\n];\n', plain: ONE_LINE_ESLINT, parentPlain: ONE_LINE_ESLINT });
    assert.match(literal[0].content ?? "", /const forkConfig = \[/);
    assert.equal(planEslint({ fork: "export default makeConfig();\n", plain: ONE_LINE_ESLINT, parentPlain: ONE_LINE_ESLINT })[0].action, "stop");
    assert.equal(planEslint({ fork: null, plain: ONE_LINE_ESLINT, parentPlain: ONE_LINE_ESLINT })[0].action, "ok");
  });
});

describe("next", () => {
  test("nextConfig に足した鍵 → { ...core, 鍵 }", () => {
    const mine = OLD_NEXT.replace("  partialPrefetching: false,\n", '  partialPrefetching: false,\n  allowedDevOrigins: ["192.168.*.*"],\n');
    const [step] = planNext({ plain: mine, prev: OLD_NEXT });
    assert.equal(step.action, "write");
    assert.match(step.content ?? "", /import core from "\.\/next\.config\.core";/);
    assert.match(step.content ?? "", /\.\.\.core,\n {2}allowedDevOrigins: \["192\.168\.\*\.\*"\],\n\};/);
    assert.match(step.content ?? "", /export default nextConfig;/);
  });

  test("export の包み(withSentryConfig)と足した import はそのまま残す", () => {
    const mine = `import { withSentryConfig } from "@sentry/nextjs";\n${OLD_NEXT.replace("export default nextConfig;\n", 'export default withSentryConfig(nextConfig, {\n  org: "acme",\n  silent: true,\n});\n')}`;
    const [step] = planNext({ plain: mine, prev: OLD_NEXT });
    assert.equal(step.action, "write");
    assert.match(step.content ?? "", /import \{ withSentryConfig \} from "@sentry\/nextjs";/);
    assert.match(step.content ?? "", /export default withSentryConfig\(nextConfig, \{\n {2}org: "acme",\n {2}silent: true,\n\}\);/);
    assert.doesNotMatch(step.content ?? "", /export default nextConfig;/);
  });

  test("上流の行を書き換えた・本体を読む形・無い", () => {
    assert.equal(planNext({ plain: OLD_NEXT.replace("cacheComponents: true", "cacheComponents: false"), prev: OLD_NEXT })[0].action, "stop");
    assert.equal(planNext({ plain: 'export { default } from "./next.config.core";\n', prev: OLD_NEXT })[0].action, "ok");
    assert.equal(planNext({ plain: null, prev: OLD_NEXT })[0].action, "stop");
  });
});

test("playwright: 自分の設定は残し、e2e の -c を外す", () => {
  const steps = planPlaywright({ plain: 'import { defineConfig } from "@playwright/test";\nexport default defineConfig({});\n', packageJson: '{ "scripts": { "e2e": "playwright test -c playwright.config.default.ts" } }\n' });
  assert.deepEqual(steps.map((s) => `${s.action} ${s.path}`), ["note playwright.config.ts", "write package.json"]);
  assert.match(steps[1].content ?? "", /"e2e": "playwright test"/);
});

describe("行のファイル", () => {
  const parent = `node_modules\n.next\n\n${MARKER}\n`;
  test("印より上の fork の行を印の下へ、既に下なら何もしない", () => {
    const [step] = planLineFile(".gitignore", { mine: `node_modules\n.sentryclirc\n.next\n\n${MARKER}\n`, parent });
    assert.equal(step.action, "write");
    assert.equal(step.content, `${parent}.sentryclirc\n`);
    assert.equal(planLineFile(".gitignore", { mine: step.content ?? "", parent })[0].action, "ok");
  });
  test("衝突の解き方で印の行が落ちた = 印を戻して fork の行をその下へ", () => {
    assert.equal(planLineFile(".gitignore", { mine: "node_modules\n.next\n.mine\n", parent })[0].content, `${parent}.mine\n`);
  });
  test("親の行を消した = 止める", () => {
    assert.equal(planLineFile(".gitignore", { mine: `.next\n.mine\n\n${MARKER}\n`, parent })[0].action, "stop");
  });
});

describe("JSON", () => {
  const parent = `${JSON.stringify({ mcpServers: { playwright: { command: "npx", args: ["@playwright/mcp@latest"] } } }, null, 2)}\n`;
  test(".mcp.json のマシンの指定 → 親の値に戻し、個人の置き場の 1 行を出す", () => {
    const mine = JSON.stringify({ mcpServers: { playwright: { command: "npx", args: ["@playwright/mcp@latest", "--browser=chromium"] }, own: { type: "http", url: "https://x" } } });
    const steps = planJson(".mcp.json", { mine, parent });
    assert.deepEqual(steps.map((s) => s.action), ["write", "note"]);
    assert.deepEqual(JSON.parse(steps[0].content ?? "").mcpServers.playwright.args, ["@playwright/mcp@latest"]);
    assert.ok(JSON.parse(steps[0].content ?? "").mcpServers.own, "fork が足したサーバーは残す");
    assert.match(steps[1].detail, /claude mcp add-json --scope local playwright '.*--browser=chromium/);
  });
  test("package.json の上流の値の変更は止めて鍵を名指す、依存の版は ok", () => {
    const pkg = JSON.stringify({ name: "next-starter", scripts: { dev: "next dev" }, dependencies: { next: "16.0.0" } });
    assert.equal(planJson("package.json", { mine: JSON.stringify({ name: "acme", scripts: { dev: "next dev" }, dependencies: { next: "16.1.0" } }), parent: pkg })[0].action, "ok");
    const [stop] = planJson("package.json", { mine: JSON.stringify({ name: "acme", scripts: { dev: "next dev --x" }, dependencies: { next: "16.0.0" } }), parent: pkg });
    assert.equal(stop.action, "stop");
    assert.match(stop.detail, /scripts\.dev/);
  });
});

describe("リポで: 既定の版(merge の HEAD)・--apply・2 回目は何もしない", () => {
  const root = mkdtempSync(join(tmpdir(), "root-files-forks-"));
  after(() => rmSync(root, { recursive: true, force: true }));
  const git = (/** @type {string[]} */ ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const put = (/** @type {Record<string, string>} */ files) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
  };

  test("取り込みの merge の後に走らせる", () => {
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    put({ "next.config.ts": OLD_NEXT, ".gitignore": "node_modules\n", "eslint.config.mjs": "export default [];\n" });
    git("add", "-A");
    git("commit", "-q", "-m", "old upstream");
    git("switch", "-q", "-c", "upstream-new");
    put({ "next.config.ts": 'export { default } from "./next.config.core";\n', "next.config.core.ts": OLD_NEXT, ".gitignore": `node_modules\n\n${MARKER}\n`, "eslint.config.mjs": ONE_LINE_ESLINT });
    git("add", "-A");
    git("commit", "-q", "-m", "new upstream");
    git("switch", "-q", "main");
    put({ "next.config.ts": OLD_NEXT.replace("  partialPrefetching: false,\n", "  partialPrefetching: false,\n  allowedDevOrigins: [\"a\"],\n"), ".gitignore": "node_modules\n.mine\n" });
    git("commit", "-q", "-am", "fork edits");
    git("merge", "-q", "--no-edit", "-X", "ours", "upstream-new");
    const revs = resolveRevs(root, {});
    assert.ok(!("error" in revs));
    const steps = plan(root, /** @type {{ from: string, to: string }} */ (revs));
    assert.deepEqual(steps.filter((s) => s.action === "write").map((s) => s.path).sort(), [".gitignore", "next.config.ts"]);
    assert.equal(steps.filter((s) => s.action === "stop").length, 1, "playwright.config.ts が無い(作り物のリポ)");
    apply(root, steps);
    assert.match(readFileSync(join(root, "next.config.ts"), "utf8"), /\.\.\.core,\n {2}allowedDevOrigins: \["a"\],/);
    assert.equal(readFileSync(join(root, ".gitignore"), "utf8"), `node_modules\n\n${MARKER}\n.mine\n`);
    const again = plan(root, /** @type {{ from: string, to: string }} */ (revs));
    assert.deepEqual(again.filter((s) => s.action === "write" || s.action === "remove"), []);
  });
});
