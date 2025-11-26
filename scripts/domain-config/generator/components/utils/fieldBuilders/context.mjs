import { getPartial, replacePartialTokens } from "../template.mjs";

const BASE_IMPORTS = [
  'import { FieldValues, type Control, type FieldPath } from "react-hook-form";',
  'import { FormFieldItem } from "@/components/Form/FormFieldItem";',
];

export function createFieldBuilderContext() {
  return {
    imports: new Set(BASE_IMPORTS),
    props: ["  control: Control<TFieldValues, any, TFieldValues>;"],
    destructure: ["  control,"],
    body: [],
    hasImageUploader: false,
    needOptionsType: false,
  };
}

export function addImport(ctx, statement) {
  ctx.imports.add(statement);
}

export function pushPartial(ctx, partialName, tokens) {
  ctx.body.push(replacePartialTokens(getPartial(partialName), tokens).trimEnd());
}

export function buildBasicTokens(field) {
  return {
    fieldName: field.name,
    label: field.label,
  };
}

export function composeComponent(ctx) {
  const importLines = Array.from(ctx.imports).join("\n");
  const propsLines = ctx.props.join("\n");
  const destructureLines = ctx.destructure.join("\n");
  const bodyLines = ctx.body.join("\n");

  return `// src/features/__domain__/components/common/__Domain__Fields.tsx\n\n${importLines}\n\nexport type __Domain__FieldsProps<TFieldValues extends FieldValues> = {\n${propsLines}\n};\n\nexport function __Domain__Fields<TFieldValues extends FieldValues>({\n${destructureLines}\n}: __Domain__FieldsProps<TFieldValues>) {\n  return (\n    <>\n${bodyLines}\n    </>\n  );\n}`;
}
