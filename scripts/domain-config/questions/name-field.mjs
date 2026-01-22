import inquirer from 'inquirer';
const prompt = inquirer.createPromptModule();

export default async function askNameField(config) {
  console.log('\n---');
  console.log('ネームフィールドについて:');
  console.log('  - コアフィールドではありませんが、定義を推奨します');
  console.log('  - リレーション取得時のラベルとして使用されるデフォルトフィールド名です');
  console.log('---\n');

  const { useNameField } = await prompt({
    type: 'confirm',
    name: 'useNameField',
    message: 'ネームフィールド (name) を作成しますか？',
    default: true,
  });

  if (!useNameField) {
    return { nameFieldEntry: null };
  }

  const { required } = await prompt({
    type: 'confirm',
    name: 'required',
    message: 'ネームフィールドを必須にしますか？',
    default: false,
  });

  const nameField = {
    name: 'name',
    label: '名前',
    fieldType: 'string',
    formInput: 'textInput',
    readonly: false,
    required,
  };

  console.log('\nネームフィールドを追加します:', nameField, '\n');

  return { nameFieldEntry: nameField };
}
