const INDENT_SIZE = 2;

const indent = (level) => " ".repeat(level * INDENT_SIZE);

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const formatOptionsArray = (options, depth) => {
  const lineIndent = indent(depth + 1);
  const entries = options.map((option) => {
    const parts = Object.entries(option).map(([key, val]) => `"${key}": ${JSON.stringify(val)}`);
    return `${lineIndent}{ ${parts.join(", ")} }`;
  });
  return `[\n${entries.join(",\n")}\n${indent(depth)}]`;
};

const formatArray = (value, depth, parentKey) => {
  if (parentKey === "options" && value.every(isPlainObject)) {
    return formatOptionsArray(value, depth);
  }
  const lineIndent = indent(depth + 1);
  const items = value.map((item) => `${lineIndent}${formatValue(item, depth + 1)}`);
  return `[\n${items.join(",\n")}\n${indent(depth)}]`;
};

const formatTagsObject = (value, depth) => {
  const lineIndent = indent(depth + 1);
  const lines = Object.entries(value).map(
    ([key, val]) => `${lineIndent}"${key}": ${JSON.stringify(val)}`,
  );
  return `{\n${lines.join(",\n")}\n${indent(depth)}}`;
};

const formatObject = (value, depth) => {
  const lineIndent = indent(depth + 1);
  const entries = Object.entries(value);
  const orderedEntries =
    entries[0]?.[0] === "domainConfigVersion"
      ? entries
      : entries.sort(([a], [b]) => {
          if (a === "domainConfigVersion") return -1;
          if (b === "domainConfigVersion") return 1;
          return 0;
        });
  const lines = orderedEntries.map(
    ([key, val]) => `${lineIndent}"${key}": ${formatValue(val, depth + 1, key)}`,
  );
  return `{\n${lines.join(",\n")}\n${indent(depth)}}`;
};

function formatValue(value, depth, parentKey) {
  if (!isPlainObject(value)) {
    if (Array.isArray(value)) {
      return formatArray(value, depth, parentKey);
    }
    return JSON.stringify(value);
  }
  // tagsオブジェクトは配列を1行で出力
  if (parentKey === "tags") {
    return formatTagsObject(value, depth);
  }
  return formatObject(value, depth);
}

export default function formatDomainConfig(config) {
  return formatValue(config, 0);
}
