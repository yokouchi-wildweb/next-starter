#!/usr/bin/env node
import fs from "fs";
import path, { dirname } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Entity generator wrapper
// Usage:
//   node scripts/domain-config/generator/entities/index.mjs <Domain>

const args = process.argv.slice(2);
const domain = args[0];

let dbEngineArg;
const dbIndex = args.findIndex((a) => a === "--dbEngine" || a === "-d");
// --dbEngine オプションがあれば取得
if (dbIndex !== -1) {
  dbEngineArg = args[dbIndex + 1];
}

// 引数が無ければドメイン設定から DB エンジンを取得
if (!dbEngineArg) {
  const camel = domain.charAt(0).toLowerCase() + domain.slice(1);
  const cfgPath = path.join(process.cwd(), "src", "features", camel, "domain.json");
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    dbEngineArg = cfg.dbEngine;
  }
}

// ドメイン名が無ければエラー
if (!domain) {
  console.error("使い方: node scripts/domain-config/generator/entities/index.mjs <Domain>");
  process.exit(1);
}

// 指定されたスクリプトを子プロセスで実行
function run(script) {
  const scriptPath = path.join(__dirname, script);
  const cmdArgs = [scriptPath, domain];
  if (dbEngineArg) cmdArgs.push("--dbEngine", dbEngineArg);
  spawnSync("node", cmdArgs, { stdio: "inherit" });
}

run("generate-model-entity.mjs");
run("generate-form-entity.mjs");
if (dbEngineArg === "Firestore") {
  run("generate-firestore-entity.mjs");
} else {
  run("generate-drizzle-entity.mjs");
}
run("generate-schema.mjs");
run("generate-entity-index.mjs");
