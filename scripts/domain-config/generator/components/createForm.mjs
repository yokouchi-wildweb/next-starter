import fs from "fs";
import path from "path";
import {
  templateDir,
  replaceTokens,
  getPartial,
  replacePartialTokens,
} from "./utils/template.mjs";
import { buildDefaultValues } from "./utils/defaultValues.mjs";
import { toPlural, toPascalCase } from "../../../../src/utils/stringCase.mjs";

export default function generate(tokens) {
  const { camel } = tokens;
  const rel = path.join("common", "Create__Domain__Form.tsx");
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

  // 関連設定からフォーム用の追加コードを生成
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

  // 画像アップロードフィールド用の追加処理を生成
  const buildImageExtras = () => {
    const images = fields.filter((f) => f.formInput === "imageUploader");
    // 画像フィールドが無い場合は何も追加しない
    if (!images.length) return { imports: "", hooks: "", props: "", submit: "" };

    const importLines = [
      'import { useImageUploaderField } from "@/hooks/useImageUploaderField";',
      'import { useRouteChangeEffect } from "@/hooks/useRouteChangeEffect";',
    ];
    const hookLines = [];
    const propLines = [];
    const submitLines = [];

    images.forEach((f) => {
      const base = (f.slug || f.name)
        .replace(/ImageUrl$/, "")
        .replace(/Url$/, "")
        .replace(/Image$/, "");
      const pascal = toPascalCase(base || f.name);
      const upVar = `upload${pascal}`;
      const rmVar = `remove${pascal}`;
      const mkVar = `markDeleted${pascal}`;
      hookLines.push(
        replacePartialTokens(getPartial("imageRouteChangeEffect.ts"), {
          fieldName: f.name,
          uploadPath: f.uploadPath,
          uploadHandler: upVar,
          deleteHandler: rmVar,
          markDeletedHandler: mkVar,
        }),
      );
      propLines.push(`onUpload${pascal}={${upVar}}`);
      propLines.push(`onDelete${pascal}={${rmVar}}`);
      submitLines.push(`      ${mkVar}();`);
      submitLines.push(`      methods.setValue("${f.name}", "");`);
    });

    return {
      imports: importLines.join("\n"),
      hooks: hookLines.join("\n"),
      props: propLines.map((p) => `      ${p}`).join("\n"),
      submit: submitLines.join("\n"),
    };
  };


  // テンプレートファイルが存在しなければエラー
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力先ディレクトリが無ければ作成
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  let template = fs.readFileSync(templatePath, "utf8");
  let content = replaceTokens(template, tokens);

  const extras = buildRelationExtras();
  const imgExtras = buildImageExtras();
  // 設定から取得したデフォルト値のコード行を生成
  const defaultLines = buildDefaultValues(domainConfig, { mode: "create" });
  // 追加の import があればテンプレートに挿入
  if (extras.imports || imgExtras.imports) {
    content = content.replace(
      'import { toast } from "sonner";',
      `import { toast } from "sonner";\n${extras.imports}${extras.imports && imgExtras.imports ? "\n" : ""}${imgExtras.imports}`,
    );
  }
  // 追加のフック処理を挿入
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
  // デフォルト値をテンプレートへ挿入
  if (defaultLines) {
    const block = `defaultValues: {\n${defaultLines}\n    },`;
    if (content.includes("defaultValues: {")) {
      content = content.replace(/defaultValues: \{[\s\S]*?\n\s*\},/, block);
    } else {
      content = content.replace("shouldUnregister: false,", `shouldUnregister: false,\n    ${block}`);
    }
  }
  // 追加のプロパティを埋め込む
    if (extras.props || imgExtras.props) {
      content = content.replace(
        "isMutating={isMutating}",
        `isMutating={isMutating}\n${extras.props}${extras.props && imgExtras.props ? "\n" : ""}${imgExtras.props}`,
      );
    }

    // 送信成功時にアップロードした画像の後処理を挿入
    if (imgExtras.submit) {
      content = content.replace(
        'toast.success("登録しました");',
        `toast.success("登録しました");\n${imgExtras.submit}`,
      );
    }

    fs.writeFileSync(outputFile, content);
    console.log(`コンポーネントを生成しました: ${outputFile}`);
  }
