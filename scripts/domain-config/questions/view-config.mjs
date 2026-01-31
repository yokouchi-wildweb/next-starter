import inquirer from 'inquirer';
const prompt = inquirer.createPromptModule();

export default async function askViewConfig(config) {
  const result = {};

  const searchChoices = (config.fields || [])
    .filter((f) => ['string', 'email', 'mediaUploader'].includes(f.fieldType))
    .map((f) => ({ name: f.name, value: f.name }));
  if (searchChoices.length > 0) {
    const { searchFields } = await prompt({
      type: 'checkbox',
      name: 'searchFields',
      message: '検索対象にするフィールド:',
      choices: searchChoices,
    });
    result.searchFields = searchFields;
  } else {
    result.searchFields = [];
  }

  const orderCandidates = [];
  const added = new Set();
  const addField = (name) => {
    if (!added.has(name)) {
      orderCandidates.push({ name, value: name });
      added.add(name);
    }
  };
  addField('id');
  if (config.useCreatedAt) addField('createdAt');
  if (config.useUpdatedAt) addField('updatedAt');
  const orderableInputs = ['textInput', 'emailInput', 'dateInput', 'datetimeInput', 'numberInput'];
  for (const f of config.fields || []) {
    if (orderableInputs.includes(f.formInput)) {
      addField(f.name);
    }
  }

  const orderBy = [];
  let remaining = orderCandidates.slice();
  while (remaining.length > 0) {
    const { field } = await prompt({
      type: 'list',
      name: 'field',
      message:
        orderBy.length === 0
          ? '並び替えに使用するフィールドを選択 (skip を選択すると設定せず次へ)':
            '次の並び替えフィールドを選択 (skip を選択すると終了):',
      choices: [{ name: 'skip', value: '' }, ...remaining],
    });
    if (!field) break;
    const { direction } = await prompt({
      type: 'list',
      name: 'direction',
      message: `${field} の並び順を選択:`,
      choices: [
        { name: 'ASC', value: 'ASC' },
        { name: 'DESC', value: 'DESC' },
      ],
    });
    orderBy.push([field, direction]);
    remaining = remaining.filter((c) => c.value !== field);
  }
  result.defaultOrderBy = orderBy;

  const tableChoices = [];
  tableChoices.push({ name: 'id', value: 'id' });
  (config.fields || []).forEach((f) => {
    tableChoices.push({ name: f.name, value: f.name });
  });
  if (config.useCreatedAt) tableChoices.push({ name: 'createdAt', value: 'createdAt' });
  if (config.useUpdatedAt) tableChoices.push({ name: 'updatedAt', value: 'updatedAt' });

  if (tableChoices.length > 0) {
    const { tableFields } = await prompt({
      type: 'checkbox',
      name: 'tableFields',
      message: '一覧で表示するフィールド:',
      choices: tableChoices,
    });
    result.tableFields = tableFields;
  } else {
    result.tableFields = [];
  }

  const { useDetailModal } = await prompt({
    type: 'confirm',
    name: 'useDetailModal',
    message: '行クリックで詳細モーダルを開きますか?',
    default: false,
  });
  result.useDetailModal = useDetailModal;

  const { useDuplicateButton } = await prompt({
    type: 'confirm',
    name: 'useDuplicateButton',
    message: '一覧に複製ボタンを表示しますか?',
    default: false,
  });
  result.useDuplicateButton = useDuplicateButton;

  const { useImportExport } = await prompt({
    type: 'confirm',
    name: 'useImportExport',
    message: 'インポート・エクスポート機能を利用しますか?',
    default: false,
  });
  result.useImportExport = useImportExport;

  const { addToAdminDataMenu } = await prompt({
    type: 'confirm',
    name: 'addToAdminDataMenu',
    message: '管理画面のデータ管理メニューに項目を追加しますか?',
    default: false,
  });
  result.addToAdminDataMenu = addToAdminDataMenu;

  const { useAutoSave } = await prompt({
    type: 'confirm',
    name: 'useAutoSave',
    message: '編集フォームでオートセーブを使用しますか?',
    default: false,
  });
  result.useAutoSave = useAutoSave;

  return result;
}
