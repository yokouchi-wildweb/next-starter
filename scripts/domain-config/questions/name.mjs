import inquirer from 'inquirer';
import { toSnakeCase, toPascalCase } from '../../../src/utils/stringCase.mjs';
const prompt = inquirer.createPromptModule();

const pluralizeWord = (name) => {
  if (/(s|x|z|ch|sh)$/.test(name)) return name + 'es';
  if (/[^aeiou]y$/.test(name)) return name.slice(0, -1) + 'ies';
  if (/[aeiou]y$/.test(name)) return name + 's';
  if (/fe?$/.test(name)) {
    if (name.endsWith('fe')) return name.slice(0, -2) + 'ves';
    return name.slice(0, -1) + 'ves';
  }
  if (/o$/.test(name)) return name + 'es';
  return name + 's';
};

const guessPlural = (name) => {
  const snake = toSnakeCase(name);
  if (!snake) return '';
  const segments = snake.split('_');
  const last = segments.pop() || '';
  segments.push(pluralizeWord(last));
  return segments.join('_');
};

export default async function askName() {
  const { singular } = await prompt({
    type: 'input',
    name: 'singular',
    message: 'ドメイン名（snake_case、例: card_set）:',
    validate: (input) => (input.trim() ? true : 'ドメイン名は必須です'),
  });

  const normalizedSingular = toSnakeCase(singular.trim());
  const suggested = guessPlural(normalizedSingular);

  const { plural } = await prompt({
    type: 'input',
    name: 'plural',
    message: `複数形名（snake_case） [${suggested}]:`,
    default: suggested,
  });

  const { label } = await prompt({
    type: 'input',
    name: 'label',
    message: '表示名:',
  });

  const trimmedSingular = normalizedSingular || toSnakeCase(singular.trim());
  const trimmedPlural = toSnakeCase(plural.trim()) || suggested;
  const defaultLabel = toPascalCase(trimmedSingular) || trimmedSingular;
  const trimmedLabel = label.trim() || defaultLabel;

  return { singular: trimmedSingular, plural: trimmedPlural, label: trimmedLabel };
}
