/**
 * @param {string | null | undefined} str
 * @returns {string[]}
 */
function splitWords(str) {
  if (!str) return [];

  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** @param {string} word */
function capitalize(word) {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function toCamelCase(str) {
  const words = splitWords(str);
  if (words.length === 0) return '';
  const [first, ...rest] = words;
  return (
    first.toLowerCase() +
    rest.map((/** @type {string} */ word) => capitalize(word)).join('')
  );
}

/**
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function toPascalCase(str) {
  const words = splitWords(str);
  if (words.length === 0) return '';
  return words.map((word) => capitalize(word)).join('');
}

/**
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function toKebabCase(str) {
  const words = splitWords(str);
  if (words.length === 0) return '';
  return words.map((word) => word.toLowerCase()).join('-');
}

/**
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function toSnakeCase(str) {
  const words = splitWords(str);
  if (words.length === 0) return '';
  return words.map((word) => word.toLowerCase()).join('_');
}
