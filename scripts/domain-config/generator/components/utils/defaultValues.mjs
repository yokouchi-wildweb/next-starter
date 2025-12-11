function isTimestampType(type) {
  return type === "timestamp" || type === "timestamp With Time Zone";
}

function formatDefaultValue(value) {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "undefined";
}

function defaultValueFor(field) {
  // field.defaultValue がある場合は優先
  if (field?.defaultValue !== undefined) {
    return formatDefaultValue(field.defaultValue);
  }

  const type = field?.fieldType;
  const formInput = field?.formInput;
  const hasOptions = Array.isArray(field?.options) && field.options.length > 0;

  switch (type) {
    case "integer":
    case "number":
    case "bigint":
    case "float":
    case "numeric(10,2)":
      return "undefined";
    case "boolean":
      if (formInput === "radio" || hasOptions) {
        return "undefined";
      }
      return "false";
    case "enum":
      return "undefined";
    case "array":
      return "[]";
    case "timestamp":
    case "timestamp With Time Zone":
      return "undefined";
    default:
      return '""';
  }
}

function buildDefaultValues(config, { mode = "create", entityVar } = {}) {
  if (!config) return "";
  const relations = config.relations || [];
  const fields = config.fields || [];
  const lines = [];

  for (const rel of relations) {
    if (rel.relationType === "belongsTo") {
      lines.push(
        mode === "create" ? `${rel.fieldName}: "",` : `${rel.fieldName}: ${entityVar}.${rel.fieldName} ?? "",`,
      );
      continue;
    }

    if (rel.relationType === "belongsToMany" && rel.includeRelationTable !== false) {
      lines.push(
        mode === "create" ? `${rel.fieldName}: [],` : `${rel.fieldName}: ${entityVar}.${rel.fieldName} ?? [],`,
      );
    }
  }

  for (const f of fields) {
    const dv = defaultValueFor(f);
    if (mode === "edit" && entityVar && isTimestampType(f.fieldType)) {
      const source = `${entityVar}.${f.name}`;
      lines.push(`${f.name}: ${source} ? new Date(${source}) : undefined,`);
      continue;
    }
    lines.push(mode === "create" ? `${f.name}: ${dv},` : `${f.name}: ${entityVar}.${f.name} ?? ${dv},`);
  }

  return lines.map((l) => `      ${l}`).join("\n");
}

export { buildDefaultValues };
