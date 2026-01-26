import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const featureRoot = path.join(projectRoot, "src", "features");
const featureTemplateRoot = path.join(featureRoot, "_template");

export function resolveFeatureTemplatePath(...segments) {
  return path.join(featureTemplateRoot, ...segments);
}

export function resolveFeaturePath(...segments) {
  return path.join(featureRoot, ...segments);
}

export function resolveFeaturesDir() {
  return featureRoot;
}

export function ensureDirExists(targetPath) {
  if (!targetPath) return;
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}
