import inquirer from 'inquirer';
const prompt = inquirer.createPromptModule();

const guessPlural = (name) => {
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

export default async function askName() {
  const { singular } = await prompt({
    type: 'input',
    name: 'singular',
    message: 'ドメイン名（camelCase または PascalCase、例: cardSet）:',
    validate: (input) => (input.trim() ? true : 'ドメイン名は必須です'),
  });

  const suggested = guessPlural(singular.trim());

  const { plural } = await prompt({
    type: 'input',
    name: 'plural',
    message: `複数形名 [${suggested}]:`,
    default: suggested,
  });

  const { label } = await prompt({
    type: 'input',
    name: 'label',
    message: '表示名:',
  });

  const trimmedSingular = singular.trim();
  const trimmedPlural = plural.trim();
  const trimmedLabel = label.trim() || trimmedSingular;

  return { singular: trimmedSingular, plural: trimmedPlural, label: trimmedLabel };
}
