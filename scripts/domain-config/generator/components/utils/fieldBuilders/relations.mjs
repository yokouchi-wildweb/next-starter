import { toCamelCase } from "../../../../../../src/utils/stringCase.mjs";
import { addImport, pushPartial } from "./context.mjs";

export function appendRelationField(ctx, relation) {
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
