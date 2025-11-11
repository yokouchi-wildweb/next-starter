function splitWords(str) {
  if (!str) return [];

  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function capitalize(word) {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function toCamelCase(str) {
  const words = splitWords(str);
  if (words.length === 0) return '';
  const [first, ...rest] = words;
  return (
    first.toLowerCase() +
    rest.map((word) => capitalize(word)).join('')
  );
}

export function toPascalCase(str) {
  const words = splitWords(str);
  if (words.length === 0) return '';
  return words.map((word) => capitalize(word)).join('');
}

export function toKebabCase(str) {
  const words = splitWords(str);
  if (words.length === 0) return '';
  return words.map((word) => word.toLowerCase()).join('-');
}

export function toSnakeCase(str) {
  const words = splitWords(str);
  if (words.length === 0) return '';
  return words.map((word) => word.toLowerCase()).join('_');
}

export function toPlural(name) {
  if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
  if (name.endsWith('s')) return name;
  return name + 's';
}
