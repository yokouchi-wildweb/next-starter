// scripts/runner/entries/readme.test.mjs — pnpm test scripts/runner/entries/readme.test.mjs
// scripts/README.md の名指しが実在するか: リンクとパス・package.json の入口・pnpm ops / workflow の対象と動作・
// pnpm check / generate の対象(gate.json のあるフォルダ)。README が実装から離れたら落ちる(stale_README)

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "../../..");
const README = join(ROOT, "scripts/README.md");
const text = readFileSync(README, "utf8");
const scripts = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts;
const PNPM_BUILTINS = new Set(["install", "exec", "dlx"]);
const isPlaceholder = (word) => /[<>[\]*]/.test(word) || word.startsWith("-") || word === "";

/** `pnpm ...` の形をコードの中(行・インライン)から全部拾う。`a|b` の並びは開く */
function pnpmCommands() {
  const out = [];
  const code = [...text.matchAll(/```[\s\S]*?```/g)].map((m) => m[0]).join("\n") + "\n" + [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]).join("\n");
  for (const line of code.split("\n")) {
    for (const m of line.matchAll(/pnpm ((?:[\w:.@/-]+(?: \| [\w:.@/-]+)*)(?: [^#&;|]*)?)/g)) {
      const words = m[1].replace(/ \| /g, "|").split(/\s+/).filter(Boolean);
      out.push({ line: line.trim(), words });
    }
  }
  return out;
}

const gateTargets = new Set(
  ["structure", "workflow", "runner", "operations"].flatMap((cat) =>
    readdirSync(join(ROOT, "scripts", cat), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(ROOT, "scripts", cat, d.name, "gate.json")))
      .map((d) => d.name),
  ),
);
const actionExists = (category, target, action) =>
  [".ts", ".mjs", ".js"].some((ext) => existsSync(join(ROOT, "scripts", category, target, `${action}${ext}`)));

test("リンクとパス: README から辿れる物が全部ある", () => {
  const missing = [];
  for (const [, link] of text.matchAll(/\]\((\.{1,2}\/[^)#]+)/g)) if (!existsSync(resolve(dirname(README), link))) missing.push(link);
  for (const [, path] of text.matchAll(/`((?:scripts|src|eslint-rules|\.claude|servers|tests)\/[^`\s]*)`/g)) {
    if (isPlaceholder(path) || path.includes("…")) continue;
    if (!existsSync(join(ROOT, path))) missing.push(path);
  }
  assert.deepEqual(missing, []);
});

test("pnpm の入口・pnpm ops / workflow の対象と動作・pnpm check / generate の対象が実在する", () => {
  const problems = [];
  for (const { line, words } of pnpmCommands()) {
    const [entries, ...rest] = words;
    for (const entry of entries.split("|")) {
      if (isPlaceholder(entry)) continue;
      if (!(entry in scripts) && !PNPM_BUILTINS.has(entry)) problems.push(`入口 ${entry}: ${line}`);
    }
    const [entry] = entries.split("|");
    if ((entry === "ops" || entry === "workflow") && rest[0] && !isPlaceholder(rest[0])) {
      const category = entry === "ops" ? "operations" : "workflow";
      if (!existsSync(join(ROOT, "scripts", category, rest[0]))) problems.push(`対象 ${category}/${rest[0]}: ${line}`);
      else if (rest[1]) {
        for (const action of rest[1].split("|")) {
          if (isPlaceholder(action) || action.includes('"')) continue;
          if (!actionExists(category, rest[0], action)) problems.push(`動作 ${category}/${rest[0]}/${action}: ${line}`);
        }
      }
    }
    if ((entry === "check" || entry === "generate") && rest[0] && !isPlaceholder(rest[0]) && !gateTargets.has(rest[0])) problems.push(`門の対象 ${rest[0]}: ${line}`);
  }
  assert.deepEqual(problems, []);
});
