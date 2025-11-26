import { toPascalCase } from "../../../../../../src/utils/stringCase.mjs";
import { addImport, buildBasicTokens, pushPartial } from "./context.mjs";

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

export function appendField(ctx, field) {
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
