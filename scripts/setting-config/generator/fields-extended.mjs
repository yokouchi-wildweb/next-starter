#!/usr/bin/env node
/**
 * ExtendedSettingFields.tsx を生成するジェネレーター
 */
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { readSettingFields } from "../utils/config-reader.mjs";
import { mapFormComponent, toPascalCase } from "../utils/type-mappers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * ExtendedSettingFields.tsx の出力パスを取得
 */
function getOutputPath() {
  const rootDir = path.resolve(__dirname, "..", "..", "..");
  return path.join(rootDir, "src", "features", "core", "setting", "components", "common", "ExtendedSettingFields.tsx");
}

/**
 * 必要なインポートを収集
 */
function collectImports(fields) {
  const controlledImports = new Set();
  const manualImports = new Set();
  let hasMediaUploader = false;

  for (const field of fields) {
    const { component } = mapFormComponent(field);
    if (component === "ControlledMediaUploader") {
      hasMediaUploader = true;
    } else if (component === "SelectInput") {
      // SelectInput は Manual からインポート
      manualImports.add(component);
    } else {
      controlledImports.add(component);
    }
  }

  return {
    controlledImports: Array.from(controlledImports),
    manualImports: Array.from(manualImports),
    hasMediaUploader,
  };
}

/**
 * enum フィールドの options 定数を生成
 */
function generateOptionsConstants(fields) {
  const enumFields = fields.filter((f) => f.fieldType === "enum" && f.options?.length > 0);
  if (enumFields.length === 0) return "";

  return enumFields.map((field) => {
    const constName = `${field.name.toUpperCase()}_OPTIONS`;
    const options = field.options.map((o) => `  { value: "${o.value}", label: "${o.label}" }`).join(",\n");
    return `const ${constName} = [\n${options},\n];`;
  }).join("\n\n") + "\n";
}

/**
 * フィールドからJSXを生成
 */
function generateFieldJsx(field) {
  const { name, label, description, formInput, options, uploadPath, accept } = field;

  // description プロップ
  let descriptionProp = "";
  if (description) {
    descriptionProp = `
        description={{
          text: "${description}",
          tone: "muted",
          size: "sm",
        }}`;
  }

  // renderInput の内容
  let renderInput = "";

  switch (formInput) {
    case "textInput":
      renderInput = `<TextInput field={field} />`;
      break;
    case "textarea":
      renderInput = `<Textarea field={field} />`;
      break;
    case "numberInput":
      renderInput = `<TextInput field={field} type="number" />`;
      break;
    case "switchInput":
      renderInput = `<SwitchInput field={field} />`;
      break;
    case "select":
      const optionsConst = `${name.toUpperCase()}_OPTIONS`;
      renderInput = `<SelectInput field={field} options={${optionsConst}} />`;
      break;
    case "radio":
      const radioOptionsConst = `${name.toUpperCase()}_OPTIONS`;
      renderInput = `<RadioGroup field={field} options={${radioOptionsConst}} />`;
      break;
    case "dateInput":
      renderInput = `<DateInput field={field} />`;
      break;
    case "datetimeInput":
      renderInput = `<DatetimeInput field={field} />`;
      break;
    case "mediaUploader":
      const path = uploadPath || "setting";
      const acceptAttr = accept || "image/*";
      renderInput = `
          <ControlledMediaUploader
            field={field}
            uploadPath="${path}"
            accept="${acceptAttr}"
          />`;
      break;
    default:
      renderInput = `<TextInput field={field} />`;
  }

  return `      <FieldItem
        control={control}
        name={"${name}" as FieldPath<TFieldValues>}
        label="${label}"${descriptionProp}
        renderInput={(field) => (
          ${renderInput.trim()}
        )}
      />`;
}

/**
 * ExtendedSettingFields.tsx を生成
 */
export default function generateFieldsExtended() {
  const config = readSettingFields();
  const fields = config?.fields ?? [];
  const { controlledImports, manualImports, hasMediaUploader } = collectImports(fields);
  const optionsConstants = generateOptionsConstants(fields);
  const fieldJsxList = fields.map(generateFieldJsx).join("\n");

  // インポート文を構築
  let controlledImportLine = "";
  if (controlledImports.length > 0) {
    controlledImportLine = `import { ${controlledImports.join(", ")} } from "@/components/Form/Controlled";`;
  }

  let manualImportLine = "";
  if (manualImports.length > 0) {
    manualImportLine = `import { ${manualImports.join(", ")} } from "@/components/Form/Manual";`;
  }

  let mediaUploaderImportLine = "";
  if (hasMediaUploader) {
    mediaUploaderImportLine = `import { ControlledMediaUploader } from "@/components/Form/MediaHandler";`;
  }

  const content = `// src/features/core/setting/components/common/ExtendedSettingFields.tsx
// [GENERATED] このファイルは自動生成されます。直接編集しないでください。
// 生成元: setting-fields.json
// 生成コマンド: pnpm sc:generate

"use client";

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FieldItem } from "@/components/Form";
${controlledImportLine}
${manualImportLine}
${mediaUploaderImportLine}

${optionsConstants}
export type ExtendedSettingFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
};

export function ExtendedSettingFields<TFieldValues extends FieldValues>({
  control,
}: ExtendedSettingFieldsProps<TFieldValues>) {
  return (
    <>
${fieldJsxList}
    </>
  );
}
`;

  const outputPath = getOutputPath();
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content, "utf-8");
  console.log(`生成完了: ${outputPath}`);
  return true;
}

// 直接実行時の処理
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateFieldsExtended();
}
