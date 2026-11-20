// scripts/structure/styles/generate-spacing-classes.ts
// 余白の段の class の表 src/lib/spacing/spacingClasses.generated.ts を、段の名前の一覧
// (src/lib/spacing/spacingScale.ts)から作り直す。中身の作り方は spacingClasses.ts。
//
// 使い方:
//   pnpm generate styles

import * as fs from "fs";
import * as path from "path";

import { renderSpacingClasses, SPACING_CLASSES_OUTPUT } from "./spacingClasses";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const out = path.join(repoRoot, SPACING_CLASSES_OUTPUT);
const next = renderSpacingClasses();
const current = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : undefined;
if (current === next) {
  console.log(`✓ ${SPACING_CLASSES_OUTPUT} は最新`);
} else {
  fs.writeFileSync(out, next);
  console.log(`✓ ${SPACING_CLASSES_OUTPUT} を書き出しました`);
}
