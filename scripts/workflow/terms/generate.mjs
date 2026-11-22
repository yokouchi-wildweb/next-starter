// scripts/workflow/terms/generate.mjs — 段階の入口(pnpm generate terms): 語の表の正本 terms.json から .claude/rules/core/terms.md を作り直す
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { renderTermsMd, TERMS_FILE, TERMS_MD } from "./lib.terms.mjs";

const root = join(import.meta.dirname, "../../..");
const next = renderTermsMd(JSON.parse(readFileSync(join(root, TERMS_FILE), "utf8")));
const path = join(root, TERMS_MD);
const same = existsSync(path) && readFileSync(path, "utf8") === next;
if (!same) writeFileSync(path, next);
console.log(`terms: ${TERMS_MD} ${same ? "変わりなし" : "を作り直した"}`);
