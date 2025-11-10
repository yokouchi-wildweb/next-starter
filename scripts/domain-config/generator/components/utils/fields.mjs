import { getPartial, replacePartialTokens } from "./template.mjs";
import { toPascalCase } from "../../../../../src/utils/stringCase.mjs";

const BOOLEAN_OPTIONS = [
  { value: true, label: "はい" },
  { value: false, label: "いいえ" },
];

function normalizeBooleanOptions(options) {
  return (options && options.length ? options : BOOLEAN_OPTIONS).map((option) => ({
    ...option,
    value: option.value === true || option.value === "true",
  }));
}

function generateFieldsFromConfig(config) {
  if (!config) return null;

  const relations = config.relations || [];
  const fields = config.fields || [];

  const imports = new Set([
    'import { FieldValues, type Control, type FieldPath } from "react-hook-form";',
    'import { FormFieldItem } from "@/components/Form/FormFieldItem";',
  ]);
  const props = ["  control: Control<TFieldValues, any, TFieldValues>;"];
  const destructure = ["  control,"];
  let hasImageUploader = false;
  const body = [];

  const addImport = (imp) => imports.add(imp);

  let needOptionsType = false;

  for (const rel of relations) {
    addImport('import { SelectInput } from "@/components/Form/manual";');
    if (rel.relationType === "belongsToMany") {
      addImport('import { CheckGroupInput } from "@/components/Form/manual";');
    }
    needOptionsType = true;

    const optName = `${rel.domain}Options`;
    props.push(`  ${optName}?: Options[];`);
    destructure.push(`  ${optName},`);

    const tplName = rel.relationType === "belongsToMany" ? "relation-belongsToMany.tsx" : "relation-belongsTo.tsx";
    const snippet = replacePartialTokens(getPartial(tplName), {
      fieldName: rel.fieldName,
      label: rel.label,
      optionsName: optName,
    });
    body.push(snippet.trimEnd());
  }

  for (const f of fields) {
    switch (f.formInput) {
      case "textInput":
        addImport('import { TextInput } from "@/components/Form/Controlled";');
        body.push(
          replacePartialTokens(getPartial("textInput.tsx"), {
            fieldName: f.name,
            label: f.label,
          }).trimEnd(),
        );
        break;
      case "numberInput":
        addImport('import { NumberInput } from "@/components/Form/Controlled";');
        body.push(
          replacePartialTokens(getPartial("numberInput.tsx"), {
            fieldName: f.name,
            label: f.label,
          }).trimEnd(),
        );
        break;
      case "numericInput":
        addImport('import StepperInput from "@/components/Form/manual/StepperInput";');
        addImport('import { FormField, FormItem, FormControl, FormMessage } from "@/components/Shadcn/form";');
        body.push(
          replacePartialTokens(getPartial("numericInput.tsx"), {
            fieldName: f.name,
            label: f.label,
          }).trimEnd(),
        );
        break;
      case "passwordInput":
        addImport('import { PasswordInput } from "@/components/Form/Controlled";');
        body.push(
          replacePartialTokens(getPartial("passwordInput.tsx"), {
            fieldName: f.name,
            label: f.label,
          }).trimEnd(),
        );
        break;
      case "textarea":
        addImport('import { Textarea } from "@/components/Form/Controlled";');
        body.push(
          replacePartialTokens(getPartial("textarea.tsx"), {
            fieldName: f.name,
            label: f.label,
          }).trimEnd(),
        );
        break;
      case "dateInput":
        addImport('import { DateInput } from "@/components/Form/Controlled";');
        body.push(
          replacePartialTokens(getPartial("dateInput.tsx"), {
            fieldName: f.name,
            label: f.label,
          }).trimEnd(),
        );
        break;
      case "select":
        addImport('import { SelectInput } from "@/components/Form/manual";');
        const opts = f.fieldType === "boolean"
          ? JSON.stringify(normalizeBooleanOptions(f.options))
          : f.options && f.options.length
            ? JSON.stringify(f.options)
            : "[]";
        body.push(
          replacePartialTokens(getPartial("select.tsx"), {
            fieldName: f.name,
            label: f.label,
            options: opts,
          }).trimEnd(),
        );
        break;
      case "radio": {
        if (f.fieldType === "boolean") {
          addImport('import { BooleanRadioGroupInput } from "@/components/Form/manual";');
          const normalizedOptions = normalizeBooleanOptions(f.options);

          body.push(
            replacePartialTokens(getPartial("radioBoolean.tsx"), {
              fieldName: f.name,
              label: f.label,
              options: JSON.stringify(normalizedOptions),
            }).trimEnd(),
          );
        } else if (f.options && f.options.length) {
          addImport('import { RadioGroupInput } from "@/components/Form/manual";');
          const optsRadio = JSON.stringify(f.options);
          body.push(
            replacePartialTokens(getPartial("radio.tsx"), {
              fieldName: f.name,
              label: f.label,
              options: optsRadio,
            }).trimEnd(),
          );
        }
        break;
      }
      case "checkbox":
        if (f.fieldType === "boolean") {
          addImport('import { BooleanCheckboxInput } from "@/components/Form/manual";');
          body.push(
            replacePartialTokens(getPartial("checkboxBoolean.tsx"), {
              fieldName: f.name,
              label: f.label,
            }).trimEnd(),
          );
        } else {
          addImport('import { Checkbox } from "@/components/Shadcn/checkbox";');
          body.push(
            replacePartialTokens(getPartial("checkbox.tsx"), {
              fieldName: f.name,
              label: f.label,
            }).trimEnd(),
          );
        }
        break;
      case "switchInput":
        addImport('import { SwitchInput } from "@/components/Form/Controlled";');
        addImport('import { FormField, FormItem, FormControl, FormMessage } from "@/components/Shadcn/form";');
        body.push(
          replacePartialTokens(getPartial("switchInput.tsx"), {
            fieldName: f.name,
            label: f.label,
          }).trimEnd(),
        );
        break;
      case "imageUploader":
        addImport('import { FileUrlInput } from "@/components/Form/Controlled";');
        const baseName = (f.slug || f.name)
          .replace(/ImageUrl$/, "")
          .replace(/Url$/, "")
          .replace(/Image$/, "");
        const pascal = toPascalCase(baseName || f.name);
        props.push(`  /** 既存の${f.label} URL (編集時のプレビュー用) */`);
        props.push(`  ${f.name}?: string | null;`);
        if (!hasImageUploader) {
          props.push("  onPendingChange?: (pending: boolean) => void;");
          destructure.push("  onPendingChange,");
          hasImageUploader = true;
        }
        props.push(`  onUpload${pascal}: (file: File) => Promise<string>;`);
        props.push(`  onDelete${pascal}?: (url: string) => Promise<void>;`);
        destructure.push(`  ${f.name},`);
        destructure.push(`  onUpload${pascal},`);
        destructure.push(`  onDelete${pascal},`);
        body.push(
          replacePartialTokens(getPartial("imageUploader.tsx"), {
            fieldName: f.name,
            label: f.label,
            name: f.name,
            uploadPath: f.uploadPath,
            uploadHandler: `onUpload${pascal}`,
            deleteHandler: `onDelete${pascal}`,
          }).trimEnd(),
        );
        break;
      default:
        addImport('import { TextInput } from "@/components/Form/Controlled";');
        body.push(
          replacePartialTokens(getPartial("textInput.tsx"), {
            fieldName: f.name,
            label: f.label,
          }).trimEnd(),
        );
    }
  }

  if (needOptionsType) {
    addImport('import type { Options } from "@/types/form";');
  }

  const importLines = Array.from(imports).join("\n");
  const propsLines = props.join("\n");
  const destructureLines = destructure.join("\n");
  const bodyLines = body.join("\n");

  return `// src/features/__domain__/components/common/__Domain__Fields.tsx\n\n${importLines}\n\nexport type __Domain__FieldsProps<TFieldValues extends FieldValues> = {\n${propsLines}\n};\n\nexport function __Domain__Fields<TFieldValues extends FieldValues>({\n${destructureLines}\n}: __Domain__FieldsProps<TFieldValues>) {\n  return (\n    <>\n${bodyLines}\n    </>\n  );\n}`;
}

export { generateFieldsFromConfig };
