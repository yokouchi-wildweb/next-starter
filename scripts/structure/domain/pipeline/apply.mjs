// Output の適用（唯一の書き込み点）。write-once / 旧形式の移行 / 変更なし / レジストリの部分書き換えの判定はここだけ

import fs from "node:fs";
import path from "node:path";

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function applyFile(out, io) {
  if (out.unchangedLabel && fs.existsSync(out.path) && fs.readFileSync(out.path, "utf8") === out.content) {
    io.log(`${out.unchangedLabel}: ${out.path}`);
    return;
  }
  writeFile(out.path, out.content);
  if (out.label) io.log(`${out.label}: ${out.path}`);
}

function applyWriteOnce(out, io) {
  if (fs.existsSync(out.path)) {
    const existing = fs.readFileSync(out.path, "utf8");
    if (out.migrate?.test(existing)) {
      writeFile(out.path, out.content);
      io.log(`${out.migrate.label}: ${out.path}`);
      return;
    }
    if (out.keptLabel) io.log(`${out.keptLabel}: ${out.path}`);
    for (const warning of out.warnOnKeep?.(existing) ?? []) io.warn(warning);
    return;
  }
  writeFile(out.path, out.content);
  if (out.label) io.log(`${out.label}: ${out.path}`);
}

function applyDir(out) {
  if (fs.existsSync(out.path)) return;
  fs.mkdirSync(out.path, { recursive: true });
  if (out.keepFile) fs.writeFileSync(path.join(out.path, out.keepFile), "");
}

function applyPatch(out, io) {
  if (!fs.existsSync(out.path)) return;
  const result = out.apply(fs.readFileSync(out.path, "utf8")) ?? {};
  if (typeof result.text === "string") fs.writeFileSync(out.path, result.text);
  for (const message of result.logs ?? []) io.log(message);
  for (const message of result.warns ?? []) io.warn(message);
}

/**
 * @param {import("../render/output.mjs").Output[]} outputs
 * @param {{ log: (message: string) => void, warn: (message: string) => void }} [io]
 */
export function applyOutputs(outputs, io = console) {
  for (const out of outputs) {
    switch (out.kind) {
      case "log":
        io.log(out.message);
        break;
      case "dir":
        applyDir(out);
        break;
      case "file":
        applyFile(out, io);
        break;
      case "writeOnce":
        applyWriteOnce(out, io);
        break;
      case "patch":
        applyPatch(out, io);
        break;
      default:
        throw new Error(`未知の Output です: ${JSON.stringify(out)}`);
    }
  }
}
