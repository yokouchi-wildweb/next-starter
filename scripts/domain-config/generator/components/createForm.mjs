import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./utils/template.mjs";

// ドメインの新規作成フォームコンポーネントを生成する
// リレーション先のデータ取得は __Domain__Fields 内の useRelationOptions で自動処理される

export default function generate(tokens) {
  const { camel } = tokens;
  const rel = path.join("common", "Create__Domain__Form.tsx");
  const templatePath = path.join(templateDir, rel);
  const outputFile = path.join(process.cwd(), "src", "features", camel, "components", replaceTokens(rel, tokens));
  const outputDir = path.dirname(outputFile);

  // テンプレートファイルが存在しなければエラー
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力先ディレクトリが無ければ作成
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const template = fs.readFileSync(templatePath, "utf8");
  const content = replaceTokens(template, tokens);

  fs.writeFileSync(outputFile, content);
  console.log(`コンポーネントを生成しました: ${outputFile}`);
}
