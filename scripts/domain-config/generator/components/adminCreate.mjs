import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./utils/template.mjs";

// 管理画面の新規作成ページ用コンポーネントを生成する
export default function generate(tokens) {
  const { camel } = tokens;
  const rel = path.join("Admin__Domain__Create", "index.tsx");
  const templatePath = path.join(templateDir, rel);
  const outputFile = path.join(process.cwd(), "src", "features", camel, "components", replaceTokens(rel, tokens));
  const outputDir = path.dirname(outputFile);

  // テンプレートファイルが存在しなければエラー終了
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力先が無ければディレクトリを作成
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const template = fs.readFileSync(templatePath, "utf8");
  const content = replaceTokens(template, tokens);
  fs.writeFileSync(outputFile, content);
  console.log(`コンポーネントを生成しました: ${outputFile}`);
}
