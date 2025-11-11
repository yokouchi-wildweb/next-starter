import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./utils/template.mjs";
import { generateFieldsFromConfig } from "./utils/fields.mjs";
// ドメインのフォームフィールドコンポーネントを生成する

export default function generate({ config, ...tokens }) {
  const { camel, pascal } = tokens;
  const rel = path.join("common", "__Domain__Fields.tsx");
  const templatePath = path.join(templateDir, rel);
  const outputFile = path.join(process.cwd(), "src", "features", camel, "components", replaceTokens(rel, tokens));
  const outputDir = path.dirname(outputFile);

  let content;
  if (rel.endsWith("__Domain__Fields.tsx") && config) {
    content = generateFieldsFromConfig(config)
      .replace(/__domain__/g, camel)
      .replace(/__Domain__/g, pascal);
  } else {
    // テンプレートが存在しない場合はエラー
    if (!fs.existsSync(templatePath)) {
      console.error(`テンプレートが見つかりません: ${templatePath}`);
      process.exit(1);
    }
    const template = fs.readFileSync(templatePath, "utf8");
    content = replaceTokens(template, tokens);
  }

  // 出力先ディレクトリが無ければ作成
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, content);
  console.log(`コンポーネントを生成しました: ${outputFile}`);
}
