import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./utils/template.mjs";
import { toPlural, toPascalCase } from "../../../../src/utils/stringCase.mjs";

export default function generate(tokens) {
  const { camel } = tokens;
  const rel = path.join("common", "Edit__Domain__Form.tsx");
  const templatePath = path.join(templateDir, rel);
  const outputFile = path.join(process.cwd(), "src", "features", camel, "components", replaceTokens(rel, tokens));
  const outputDir = path.dirname(outputFile);

  const configPath = path.join(process.cwd(), "src", "features", camel, "domain.json");
  let relations = [];
  let domainConfig = null;
  // ドメイン設定ファイルがあれば読み込む
  if (fs.existsSync(configPath)) {
    domainConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const relationList = domainConfig.relations || [];
    relations = relationList.filter((rel) => {
      if (rel.relationType === "belongsTo") return true;
      if (rel.relationType === "belongsToMany") {
        return rel.includeRelationTable !== false;
      }
      return false;
    });
  }

  // 関連設定からフォーム向けのコード片を生成
  const buildRelationExtras = () => {
    // 関連が無ければ空オブジェクトを返す
    if (!relations.length) return { imports: "", hooks: "", optionLines: "", props: "" };

    const importLines = [];
    const hookLines = [];
    const optionLines = [];
    const propLines = [];

    relations.forEach((rel) => {
      const domPascal = toPascalCase(rel.domain);
      const domCamel = domPascal.charAt(0).toLowerCase() + domPascal.slice(1);
      const domCamelPlural = toPlural(domCamel);
      const hookName = `use${domPascal}List`;
      const labelField = rel.labelField || "name";

      importLines.push(
        `import { ${hookName} } from "@/features/${domCamel}/hooks/${hookName}";`,
      );
      hookLines.push(
        `  const { data: ${domCamelPlural} = [] } = ${hookName}({ suspense: true });`,
      );
      optionLines.push(
        `  const ${domCamel}Options = ${domCamelPlural}.map((v) => ({ value: v.id, label: v.${labelField} }));`,
      );
      propLines.push(`${domCamel}Options={${domCamel}Options}`);
    });

    return {
      imports: importLines.join("\n"),
      hooks: hookLines.join("\n"),
      optionLines: optionLines.join("\n"),
      props: propLines.map((p) => `      ${p}`).join("\n"),
    };
  };

  // テンプレートが無い場合はエラー
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力ディレクトリが無ければ作成
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  let template = fs.readFileSync(templatePath, "utf8");
  let content = replaceTokens(template, tokens);

  const extras = buildRelationExtras();
  // 追加の import を挿入
  if (extras.imports) {
    content = content.replace(
      'import { useToast, useLoadingToast } from "@/lib/toast";',
      `import { useToast, useLoadingToast } from "@/lib/toast";\n${extras.imports}`,
    );
  }
  // フォーム用のフック処理を挿入
  if (extras.hooks) {
    const lines = [];
    if (extras.hooks) {
      lines.push(extras.hooks);
    }
    if (extras.optionLines) {
      if (extras.hooks) lines.push("");
      lines.push(extras.optionLines);
    }
    content = content.replace("const router = useRouter();", `${lines.join("\n")}\n\n  const router = useRouter();`);
  }
  // 生成した props を差し込む
  if (extras.props) {
    content = content.replace(
      "isMutating={isMutating}",
      `isMutating={isMutating}\n${extras.props}`,
    );
  }

  fs.writeFileSync(outputFile, content);
  console.log(`コンポーネントを生成しました: ${outputFile}`);
}
