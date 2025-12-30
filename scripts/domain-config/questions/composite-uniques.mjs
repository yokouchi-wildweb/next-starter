import inquirer from 'inquirer';

const prompt = inquirer.createPromptModule();

/**
 * 複合ユニーク制約の質問
 * フィールド定義完了後に呼び出される
 */
export default async function askCompositeUniques(config) {
  const compositeUniques = [];

  // フィールドが2つ未満の場合はスキップ
  const availableFields = config.fields || [];
  if (availableFields.length < 2) {
    return { compositeUniques };
  }

  // リレーションのフィールドも選択肢に含める
  const relationFields = (config.relations || [])
    .filter((rel) => rel.relationType === 'belongsTo')
    .map((rel) => ({
      name: rel.fieldName,
      label: rel.label || rel.fieldName,
    }));

  const allFieldChoices = [
    ...availableFields.map((f) => ({
      name: `${f.label} (${f.name})`,
      value: f.name,
    })),
    ...relationFields.map((f) => ({
      name: `${f.label} (${f.name}) [リレーション]`,
      value: f.name,
    })),
  ];

  if (allFieldChoices.length < 2) {
    return { compositeUniques };
  }

  while (true) {
    const { addConstraint } = await prompt({
      type: 'confirm',
      name: 'addConstraint',
      message:
        compositeUniques.length === 0
          ? '複合ユニーク制約を追加しますか？'
          : '別の複合ユニーク制約を追加しますか？',
      default: false,
    });

    if (!addConstraint) break;

    const { selectedFields } = await prompt({
      type: 'checkbox',
      name: 'selectedFields',
      message:
        '複合ユニーク制約に含めるフィールドを選択してください（2つ以上）:',
      choices: allFieldChoices,
      validate: (answer) => {
        if (answer.length < 2) {
          return '2つ以上のフィールドを選択してください。';
        }
        return true;
      },
    });

    compositeUniques.push({ fields: selectedFields });
    console.log(`\n複合ユニーク制約を追加しました: [${selectedFields.join(', ')}]\n`);
  }

  return { compositeUniques };
}
