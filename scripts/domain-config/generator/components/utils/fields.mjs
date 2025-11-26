import { createFieldBuilderContext, addImport, composeComponent } from "./fieldBuilders/context.mjs";
import { appendRelationField } from "./fieldBuilders/relations.mjs";
import { appendField } from "./fieldBuilders/inputHandlers.mjs";

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
