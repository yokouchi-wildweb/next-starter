import inquirer from 'inquirer';
const prompt = inquirer.createPromptModule();

export default async function askBaseFields() {
  const { useCreatedAt } = await prompt({
    type: 'confirm',
    name: 'useCreatedAt',
    message: 'createdAt フィールドを追加しますか?',
    default: true,
  });

  const { useUpdatedAt } = await prompt({
    type: 'confirm',
    name: 'useUpdatedAt',
    message: 'updatedAt フィールドを追加しますか?',
    default: true,
  });

  return {
    useCreatedAt,
    useUpdatedAt,
  };
}
