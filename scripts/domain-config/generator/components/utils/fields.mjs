import { toPascalCase } from "../../../../../src/utils/stringCase.mjs";

function buildRelationInfo(rel) {
  const domainPascal = toPascalCase(rel.domain) || rel.domain;
  const domainCamel = domainPascal.charAt(0).toLowerCase() + domainPascal.slice(1);
  const propName = `${domainCamel}Options`;
  const label = rel.label || domainPascal;
  if (rel.relationType === "belongsTo") {
    return {
      propName,
      dependency: propName,
      config: `      {
        name: "${rel.fieldName}",
        label: "${label}",
        formInput: "select",
        options: ${propName} as FieldConfig["options"],
      }`,
    };
  }
  if (rel.relationType === "belongsToMany" && rel.includeRelationTable !== false) {
    return {
      propName,
      dependency: propName,
      config: `      {
        name: "${rel.fieldName}",
        label: "${label}",
        formInput: "checkbox",
        fieldType: "array",
        options: ${propName} as FieldConfig["options"],
      }`,
    };
  }
  return null;
}

function generateFieldsFromConfig(config) {
  if (!config) return null;

  const relationInfos = (config.relations || [])
    .map((rel) => buildRelationInfo(rel))
    .filter((info) => info !== null);

  const relationEntries = relationInfos;
  const dependencyList = relationEntries.map((entry) => entry.dependency);
  const relationArray = relationEntries.length
    ? `[
${relationEntries.map((entry) => entry.config).join(",\n")}
    ]`
    : "[]";
  const dependencyArray = dependencyList.length ? `[${dependencyList.join(", ")}]` : "[]";

  const optionProps = relationEntries
    .map((entry) => `  ${entry.propName}?: Options[];`)
    .join("\n");
  const destructureOptions = relationEntries
    .map((entry) => `  ${entry.propName},`)
    .join("\n");

  const optionImports = relationEntries.length ? '\nimport type { Options } from "@/components/Form/types";' : "";

  const propsBlock = optionProps ? `\n${optionProps}` : "";
  const destructureBlock = destructureOptions ? `\n${destructureOptions}` : "";

  // リレーションがある場合のみ useMemo を使う
  const hasRelations = relationEntries.length > 0;

  const useMemoImport = hasRelations ? "import { useMemo } from \"react\";\n" : "";
  const fieldPatchesBlock = hasRelations
    ? `
  const fieldPatches = useMemo<FieldConfig[]>(
    () => ${relationArray},
    ${dependencyArray},
  );
`
    : "";

  const fieldPatchesProp = hasRelations ? "\n      fieldPatches={fieldPatches}" : "";

  return `// src/features/__domain__/components/common/__Domain__Fields.tsx

${useMemoImport}import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";${optionImports}
import domainConfig from "@/features/__domain__/domain.json";

export type __Domain__FieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: MediaState | null) => void;${propsBlock}
};

export function __Domain__Fields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,${destructureBlock}
}: __Domain__FieldsProps<TFieldValues>) {${fieldPatchesBlock}
  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={(domainConfig.fields ?? []) as FieldConfig[]}${fieldPatchesProp}
      onMediaStateChange={onMediaStateChange}
    />
  );
}
`;
}

export { generateFieldsFromConfig };
