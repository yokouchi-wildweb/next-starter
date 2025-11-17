import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./utils/template.mjs";

// 一覧テーブルコンポーネントを生成する

export default function generate({ config, ...tokens }) {
  const { camel } = tokens;
  const templateFile = config?.useDetailModal
    ? "Table.withDetailModal.tsx"
    : "Table.tsx";
  const rel = path.join("Admin__Domain__List", templateFile);
  const templatePath = path.join(templateDir, rel);
  const outputRel = path.join("Admin__Domain__List", "Table.tsx");
  const outputFile = path.join(
    process.cwd(),
    "src",
    "features",
    camel,
    "components",
    replaceTokens(outputRel, tokens),
  );
  const outputDir = path.dirname(outputFile);

  // テンプレートファイルが無ければエラー終了
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力ディレクトリが無ければ作成
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const template = fs.readFileSync(templatePath, "utf8");
  const content = replaceTokens(template, tokens);
  fs.writeFileSync(outputFile, content);
  console.log(`コンポーネントを生成しました: ${outputFile}`);
}
