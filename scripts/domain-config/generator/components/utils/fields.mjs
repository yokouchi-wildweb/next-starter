import { getPartial, replacePartialTokens } from "./template.mjs";
import { toCamelCase, toPascalCase } from "../../../../../src/utils/stringCase.mjs";

const BOOLEAN_OPTIONS = [
  { value: true, label: "はい" },
  { value: false, label: "いいえ" },
];

const BASE_IMPORTS = [
  'import { FieldValues, type Control, type FieldPath } from "react-hook-form";',
  'import { FormFieldItem } from "@/components/Form/FormFieldItem";',
];

function normalizeBooleanOptions(options) {
  return (options && options.length ? options : BOOLEAN_OPTIONS).map((option) => ({
    ...option,
    value: option.value === true || option.value === "true",
  }));
}

function createFieldBuilderContext() {
  return {
    imports: new Set(BASE_IMPORTS),
    props: ["  control: Control<TFieldValues, any, TFieldValues>;"],
    destructure: ["  control,"],
    body: [],
    hasImageUploader: false,
    needOptionsType: false,
  };
}

function addImport(ctx, statement) {
  ctx.imports.add(statement);
}

function pushPartial(ctx, partialName, tokens) {
  ctx.body.push(replacePartialTokens(getPartial(partialName), tokens).trimEnd());
}

function appendRelationField(ctx, relation) {
  const relCamel = toCamelCase(relation.domain) || relation.domain;
  addImport(ctx, 'import { SelectInput } from "@/components/Form/Manual";');
  if (relation.relationType === "belongsToMany") {
    addImport(ctx, 'import { CheckGroupInput } from "@/components/Form/Manual";');
  }
  ctx.needOptionsType = true;

  const optionsName = `${relCamel}Options`;
  ctx.props.push(`  ${optionsName}?: Options[];`);
  ctx.destructure.push(`  ${optionsName},`);

  const partialName =
    relation.relationType === "belongsToMany" ? "relation-belongsToMany.tsx" : "relation-belongsTo.tsx";
  pushPartial(ctx, partialName, {
    fieldName: relation.fieldName,
    label: relation.label,
    optionsName,
  });
}

function appendField(ctx, field) {
  switch (field.formInput) {
    case "textInput":
      addImport(ctx, 'import { TextInput } from "@/components/Form/Controlled";');
      pushPartial(ctx, "textInput.tsx", buildBasicTokens(field));
      break;
    case "emailInput":
      addImport(ctx, 'import { EmailInput } from "@/components/Form/Controlled";');
      pushPartial(ctx, "emailInput.tsx", buildBasicTokens(field));
      break;
    case "numberInput":
      addImport(ctx, 'import { NumberInput } from "@/components/Form/Controlled";');
      pushPartial(ctx, "numberInput.tsx", buildBasicTokens(field));
      break;
    case "stepperInput":
      addImport(ctx, 'import StepperInput from "@/components/Form/Manual/StepperInput";');
      addImport(ctx, 'import { FormField, FormItem, FormControl, FormMessage } from "@/components/_shadcn/form";');
      pushPartial(ctx, "stepperInput.tsx", buildBasicTokens(field));
      break;
    case "passwordInput":
      addImport(ctx, 'import { PasswordInput } from "@/components/Form/Controlled";');
      pushPartial(ctx, "passwordInput.tsx", buildBasicTokens(field));
      break;
    case "textarea":
      addImport(ctx, 'import { Textarea } from "@/components/Form/Controlled";');
      pushPartial(ctx, "textarea.tsx", buildBasicTokens(field));
      break;
    case "dateInput":
      addImport(ctx, 'import { DateInput } from "@/components/Form/Controlled";');
      pushPartial(ctx, "dateInput.tsx", buildBasicTokens(field));
      break;
    case "datetimeInput":
      addImport(ctx, 'import { DatetimeInput } from "@/components/Form/Controlled";');
      pushPartial(ctx, "datetimeInput.tsx", buildBasicTokens(field));
      break;
    case "timeInput":
      addImport(ctx, 'import { TimeInput } from "@/components/Form/Controlled";');
      pushPartial(ctx, "timeInput.tsx", buildBasicTokens(field));
      break;
    case "select":
      appendSelectField(ctx, field);
      break;
    case "multiSelect":
      addImport(ctx, 'import { MultiSelectInput } from "@/components/Form/Manual";');
      pushPartial(ctx, "multiSelect.tsx", {
        fieldName: field.name,
        label: field.label,
        options: JSON.stringify(field.options && field.options.length ? field.options : []),
      });
      break;
    case "radio":
      appendRadioField(ctx, field);
      break;
    case "checkbox":
      appendCheckboxField(ctx, field);
      break;
    case "switchInput":
      addImport(ctx, 'import { SwitchInput } from "@/components/Form/Controlled";');
      addImport(ctx, 'import { FormField, FormItem, FormControl, FormMessage } from "@/components/_shadcn/form";');
      pushPartial(ctx, "switchInput.tsx", buildBasicTokens(field));
      break;
    case "imageUploader":
      appendImageUploaderField(ctx, field);
      break;
    default:
      addImport(ctx, 'import { TextInput } from "@/components/Form/Controlled";');
      pushPartial(ctx, "textInput.tsx", buildBasicTokens(field));
  }
}

function appendSelectField(ctx, field) {
  addImport(ctx, 'import { SelectInput } from "@/components/Form/Manual";');
  const options =
    field.fieldType === "boolean"
      ? JSON.stringify(normalizeBooleanOptions(field.options))
      : JSON.stringify(field.options && field.options.length ? field.options : []);
  pushPartial(ctx, "select.tsx", {
    fieldName: field.name,
    label: field.label,
    options,
  });
}

function appendRadioField(ctx, field) {
  if (field.fieldType === "boolean") {
    addImport(ctx, 'import { BooleanRadioGroupInput } from "@/components/Form/Manual";');
    pushPartial(ctx, "radioBoolean.tsx", {
      fieldName: field.name,
      label: field.label,
      options: JSON.stringify(normalizeBooleanOptions(field.options)),
    });
    return;
  }
  if (field.options && field.options.length) {
    addImport(ctx, 'import { RadioGroupInput } from "@/components/Form/Manual";');
    pushPartial(ctx, "radio.tsx", {
      fieldName: field.name,
      label: field.label,
      options: JSON.stringify(field.options),
    });
  }
}

function appendCheckboxField(ctx, field) {
  if (field.fieldType === "boolean") {
    addImport(ctx, 'import { BooleanCheckboxInput } from "@/components/Form/Manual";');
    pushPartial(ctx, "checkboxBoolean.tsx", buildBasicTokens(field));
    return;
  }
  if (field.fieldType === "array") {
    addImport(ctx, 'import { CheckGroupInput } from "@/components/Form/Manual";');
    pushPartial(ctx, "checkboxGroup.tsx", {
      fieldName: field.name,
      label: field.label,
      options: JSON.stringify(field.options && field.options.length ? field.options : []),
    });
    return;
  }
  addImport(ctx, 'import { Checkbox } from "@/components/Shadcn/checkbox";');
  pushPartial(ctx, "checkbox.tsx", buildBasicTokens(field));
}

function appendImageUploaderField(ctx, field) {
  addImport(ctx, 'import { FileUrlInput } from "@/components/Form/Controlled";');
  const baseName = (field.slug || field.name)
    .replace(/ImageUrl$/, "")
    .replace(/Url$/, "")
    .replace(/Image$/, "");
  const pascal = toPascalCase(baseName || field.name);

  ctx.props.push(`  /** 既存の${field.label} URL (編集時のプレビュー用) */`);
  ctx.props.push(`  ${field.name}?: string | null;`);
  if (!ctx.hasImageUploader) {
    ctx.props.push("  onPendingChange?: (pending: boolean) => void;");
    ctx.destructure.push("  onPendingChange,");
    ctx.hasImageUploader = true;
  }
  ctx.props.push(`  onUpload${pascal}: (file: File) => Promise<string>;`);
  ctx.props.push(`  onDelete${pascal}?: (url: string) => Promise<void>;`);
  ctx.destructure.push(`  ${field.name},`);
  ctx.destructure.push(`  onUpload${pascal},`);
  ctx.destructure.push(`  onDelete${pascal},`);

  pushPartial(ctx, "imageUploader.tsx", {
    fieldName: field.name,
    label: field.label,
    name: field.name,
    uploadPath: field.uploadPath,
    uploadHandler: `onUpload${pascal}`,
    deleteHandler: `onDelete${pascal}`,
  });
}

function buildBasicTokens(field) {
  return {
    fieldName: field.name,
    label: field.label,
  };
}

function composeComponent(ctx) {
  const importLines = Array.from(ctx.imports).join("\n");
  const propsLines = ctx.props.join("\n");
  const destructureLines = ctx.destructure.join("\n");
  const bodyLines = ctx.body.join("\n");

  return `// src/features/__domain__/components/common/__Domain__Fields.tsx\n\n${importLines}\n\nexport type __Domain__FieldsProps<TFieldValues extends FieldValues> = {\n${propsLines}\n};\n\nexport function __Domain__Fields<TFieldValues extends FieldValues>({\n${destructureLines}\n}: __Domain__FieldsProps<TFieldValues>) {\n  return (\n    <>\n${bodyLines}\n    </>\n  );\n}`;
}

function generateFieldsFromConfig(config) {
  if (!config) return null;

  const ctx = createFieldBuilderContext();
  const relations = (config.relations || []).filter((rel) => {
    if (rel.relationType === "belongsTo") return true;
    if (rel.relationType === "belongsToMany") {
      return rel.includeRelationTable !== false;
    }
    return false;
  });

  relations.forEach((rel) => appendRelationField(ctx, rel));
  (config.fields || []).forEach((field) => appendField(ctx, field));

  if (ctx.needOptionsType) {
    addImport(ctx, 'import type { Options } from "@/types/form";');
  }

  return composeComponent(ctx);
}

export { generateFieldsFromConfig };
