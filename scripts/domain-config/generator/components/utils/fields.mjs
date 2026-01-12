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
        type: "select",
        name: "${rel.fieldName}" as FieldPath<TFieldValues>,
        label: "${label}",
        options: ${propName},
      }`,
    };
  }
  if (rel.relationType === "belongsToMany" && rel.includeRelationTable !== false) {
    return {
      propName,
      dependency: propName,
      config: `      {
        type: "checkGroup",
        name: "${rel.fieldName}" as FieldPath<TFieldValues>,
        label: "${label}",
        options: ${propName},
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

  const metadataFields = (config.fields || []).filter(
    (field) =>
      field.formInput === "mediaUploader" &&
      field.metadataBinding &&
      Object.keys(field.metadataBinding || {}).length > 0,
  );

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

  const importItems = [
    "DomainFieldRenderer",
    "type DomainFieldRenderConfig",
    "type DomainMediaState",
  ];
  if (metadataFields.length) {
    importItems.push("useMediaFieldHandler");
  }

  const metadataHookImport = metadataFields.length
    ? '\nimport { useMediaMetadataBinding } from "@/lib/mediaInputSuite/hooks";'
    : "";

  const propsBlock = optionProps ? `\n${optionProps}` : "";
  const destructureBlock = destructureOptions ? `\n${destructureOptions}` : "";

  return `// src/features/__domain__/components/common/__Domain__Fields.tsx

import { useMemo } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import {
  ${importItems.join(",\n  ")},
} from "@/components/Form/DomainFieldRenderer";${optionImports}${metadataHookImport}
import domainConfig from "@/features/__domain__/domain.json";

export type __Domain__FieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: DomainMediaState | null) => void;${propsBlock}
};

export function __Domain__Fields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,${destructureBlock}
}: __Domain__FieldsProps<TFieldValues>) {
  const relationFieldConfigs = useMemo<DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>[]>(
    () => ${relationArray},
    ${dependencyArray},
  );

${metadataFields
  .map((field, index) => {
    const handlerName = `handle${toPascalCase(field.name)}Metadata`;
    const stateVar = `mediaFieldState${index}`;
    const prevStateVar = index === 0 ? null : `mediaFieldState${index - 1}`;
    const bindingEntries = Object.entries(field.metadataBinding || {})
      .map(
        ([key, value]) =>
          `      ${key}: "${value}" as FieldPath<TFieldValues>,`,
      )
      .join("\n");
    const domainSource = prevStateVar ? `${prevStateVar}.filteredDomainJsonFields` : "domainConfig.fields ?? []";
    const baseSource = prevStateVar ? `${prevStateVar}.customFields` : "relationFieldConfigs";
    return `  const ${handlerName} = useMediaMetadataBinding({
    methods,
    binding: {
${bindingEntries}
    },
  });

  const ${stateVar} = useMediaFieldHandler({
    domainFields: ${domainSource},
    targetFieldName: "${field.name}",
    baseFields: ${baseSource},
    onMetadataChange: ${handlerName},
  });`;
  })
  .join("\n\n")}

  const customFields = ${
    metadataFields.length ? `mediaFieldState${metadataFields.length - 1}.customFields` : "relationFieldConfigs"
  };
  const filteredDomainJsonFields = ${
    metadataFields.length
      ? `mediaFieldState${metadataFields.length - 1}.filteredDomainJsonFields`
      : "domainConfig.fields ?? []"
  };

  return (
    <DomainFieldRenderer
      control={methods.control}
      methods={methods}
      fields={customFields}
      domainJsonFields={filteredDomainJsonFields}
      onMediaStateChange={onMediaStateChange}
    />
  );
}`;
}

export { generateFieldsFromConfig };
