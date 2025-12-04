import inquirer from 'inquirer';
const prompt = inquirer.createPromptModule();

export default async function askGenerateFiles() {
  const { files } = await prompt({
    type: 'checkbox',
    name: 'files',
    message: '生成するファイルを選択:',
    default: [
      'entities',
      'components',
      'hooks',
      'clientServices',
      'serverServices',
      'fieldConstants',
      'adminRoutes',
      'registry',
      'presenters',
    ],
    choices: [
      { name: 'エンティティ', value: 'entities' },
      { name: 'コンポーネント', value: 'components' },
      { name: 'フック', value: 'hooks' },
      { name: 'クライアントサービス', value: 'clientServices' },
      { name: 'サーバーサービス', value: 'serverServices' },
      { name: 'Enum 定数/型', value: 'fieldConstants' },
      { name: '管理画面ルート', value: 'adminRoutes' },
      { name: 'ドメインレジストリに追加', value: 'registry' },
      { name: 'プレゼンター', value: 'presenters' },
    ],
  });

  const generateFiles = {
    entities: files.includes('entities'),
    components: files.includes('components'),
    hooks: files.includes('hooks'),
    clientServices: files.includes('clientServices'),
    serverServices: files.includes('serverServices'),
    fieldConstants: files.includes('fieldConstants'),
    adminRoutes: files.includes('adminRoutes'),
    registry: files.includes('registry'),
    presenters: files.includes('presenters'),
  };

  return { generateFiles };
}
