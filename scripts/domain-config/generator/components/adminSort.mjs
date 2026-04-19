import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./utils/template.mjs";

// 並び替えページのコンテナコンポーネント（Admin__Domain__Sort）を生成する
// sortOrderField が設定されているドメインでのみ意味を持つ
export default function generate({ config, ...tokens }) {
  const { camel } = tokens;

  // sortOrderField が無いドメインではスキップ
  if (!config?.sortOrderField) {
    console.warn(`${camel}: sortOrderField が設定されていないため Admin__Domain__Sort をスキップします`);
    return;
  }

  const rel = path.join("Admin__Domain__Sort", "index.tsx");
  const templatePath = path.join(templateDir, rel);
  const outputFile = path.join(process.cwd(), "src", "features", camel, "components", replaceTokens(rel, tokens));
  const outputDir = path.dirname(outputFile);

  // テンプレートが無ければ終了
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
