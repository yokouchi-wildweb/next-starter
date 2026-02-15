import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./template.mjs";
import { ensureDirExists } from "../../utils/pathHelpers.mjs";

// 単一フックのテンプレートを読み込み、トークン置換して出力する共通関数
export default function generateHookFile(templateFileName, tokens) {
  const { camel } = tokens;
  const templatePath = path.join(templateDir, templateFileName);
  const outputFileName = replaceTokens(templateFileName, tokens);
  const outputDir = path.join(process.cwd(), "src", "features", camel, "hooks");
  const outputFile = path.join(outputDir, outputFileName);

  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  ensureDirExists(outputDir);

  const template = fs.readFileSync(templatePath, "utf8");
  const content = replaceTokens(template, tokens);

  fs.writeFileSync(outputFile, content);
  console.log(`フックを生成しました: ${outputFile}`);
}
