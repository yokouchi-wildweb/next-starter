import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./utils/template.mjs";
import { buildDefaultValues } from "./utils/defaultValues.mjs";
import { toPlural, toPascalCase } from "../../../../src/utils/stringCase.mjs";

export default function generate(tokens) {
  const { camel } = tokens;
  const rel = path.join("common", "Edit__Domain__Form.tsx");
  const templatePath = path.join(templateDir, rel);
  const outputFile = path.join(process.cwd(), "src", "features", camel, "components", replaceTokens(rel, tokens));
  const outputDir = path.dirname(outputFile);

  const configPath = path.join(process.cwd(), "src", "features", camel, "domain.json");
  let relations = [];
  let fields = [];
  let domainConfig = null;
  // ドメイン設定ファイルがあれば読み込む
  if (fs.existsSync(configPath)) {
    domainConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    relations = domainConfig.relations || [];
    fields = domainConfig.fields || [];
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

      importLines.push(
        `import { ${hookName} } from "@/features/${domCamel}/hooks/${hookName}";`,
      );
      hookLines.push(
        `  const { data: ${domCamelPlural} = [] } = ${hookName}({ suspense: true });`,
      );
      optionLines.push(
        `  const ${domCamel}Options = ${domCamelPlural}.map((v) => ({ value: v.id, label: v.name }));`,
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

  // 画像アップロードフィールドの処理を組み立てる
  const buildImageExtras = () => {
    const images = fields.filter((f) => f.formInput === "imageUploader");
    // 対象が無ければ何も返さない
    if (!images.length) return { imports: "", hooks: "", props: "" };

    const importLines = ['import { useImageUploaderField } from "@/hooks/useImageUploaderField";'];
    const hookLines = [];
    const propLines = [];

    images.forEach((f) => {
      const base = (f.slug || f.name)
        .replace(/ImageUrl$/, "")
        .replace(/Url$/, "")
        .replace(/Image$/, "");
      const pascal = toPascalCase(base || f.name);
      const upVar = `upload${pascal}`;
      const rmVar = `remove${pascal}`;
      hookLines.push(
        `  const { upload: ${upVar}, remove: ${rmVar} } = useImageUploaderField(methods, "${f.name}", "${f.uploadPath}", false);`,
      );
      propLines.push(`onUpload${pascal}={${upVar}}`);
      propLines.push(`onDelete${pascal}={${rmVar}}`);
    });

    return {
      imports: importLines.join("\n"),
      hooks: hookLines.join("\n"),
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
  const imgExtras = buildImageExtras();
  // デフォルト値のコードを生成
  const defaultLines = buildDefaultValues(domainConfig, {
    mode: "edit",
    entityVar: camel,
  });
  // 追加の import を挿入
  if (extras.imports || imgExtras.imports) {
    content = content.replace(
      'import { toast } from "sonner";',
      `import { toast } from "sonner";\n${extras.imports}${extras.imports && imgExtras.imports ? "\n" : ""}${imgExtras.imports}`,
    );
  }
  // フォーム用のフック処理を挿入
  if (extras.hooks || imgExtras.hooks) {
    const lines = [];
    if (extras.hooks) {
      lines.push(extras.hooks);
    }
    if (extras.optionLines) {
      if (extras.hooks) lines.push("");
      lines.push(extras.optionLines);
    }
    if (imgExtras.hooks) {
      if (extras.hooks || extras.optionLines) lines.push("");
      lines.push(imgExtras.hooks);
    }
    content = content.replace("const router = useRouter();", `${lines.join("\n")}\n\n  const router = useRouter();`);
  }
  // デフォルト値があればテンプレートへ差し込む
  if (defaultLines) {
    const block = `defaultValues: {\n${defaultLines}\n    },`;
    if (/defaultValues: \{\n\s*\/\/ TODO: 初期値を設定してください\n\s*\},/.test(content)) {
      content = content.replace(/defaultValues: \{\n\s*\/\/ TODO: 初期値を設定してください\n\s*\},/, block);
    } else if (content.includes("defaultValues: {")) {
      content = content.replace(/defaultValues: \{[\s\S]*?\n\s*\},/, block);
    } else {
      content = content.replace("shouldUnregister: false,", `shouldUnregister: false,\n    ${block}`);
    }
    // remove any remaining TODO defaults that might appear after insertion
    content = content.replace(/\n\s*defaultValues: \{\n\s*\/\/ TODO: 初期値を設定してください\n\s*\},/, "");
  }
  // 生成した props を差し込む
  if (extras.props || imgExtras.props) {
    content = content.replace(
      "isMutating={isMutating}",
      `isMutating={isMutating}\n${extras.props}${extras.props && imgExtras.props ? "\n" : ""}${imgExtras.props}`,
    );
  }

  fs.writeFileSync(outputFile, content);
  console.log(`コンポーネントを生成しました: ${outputFile}`);
}
