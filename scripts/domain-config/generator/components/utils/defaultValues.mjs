function isTimestampType(type) {
  return type === "timestamp" || type === "timestamp With Time Zone";
}

function defaultValueFor(type) {
  switch (type) {
    case "integer":
    case "number":
      return "undefined";
    case "boolean":
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
    } else if (rel.relationType === "belongsToMany") {
      lines.push(
        mode === "create" ? `${rel.fieldName}: [],` : `${rel.fieldName}: ${entityVar}.${rel.fieldName} ?? [],`,
      );
    }
  }

  for (const f of fields) {
    const dv = defaultValueFor(f.fieldType);
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
