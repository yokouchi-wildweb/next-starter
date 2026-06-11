import inquirer from 'inquirer';
const prompt = inquirer.createPromptModule();

// 汎用 API (/api/[domain]/**) のアクセスルール選択肢
// 詳細（個別ロール指定・operations 単位の上書き）は domain.json を直接編集する
// スキーマ: src/features/README.md「ApiAccess」
const RULE_CHOICES = [
  { name: '管理者のみ (admin カテゴリ) ※推奨', value: { roleCategories: ['admin'] } },
  { name: 'ログインユーザー (authenticated)', value: 'authenticated' },
  { name: '公開 (public) ※未認証でもアクセス可', value: 'public' },
  { name: '無効 (none) ※汎用 API を 404 にする', value: 'none' },
];

export default async function askApiAccess() {
  const { read } = await prompt({
    type: 'list',
    name: 'read',
    message: '汎用 API の読み取り操作 (list/get/search/count) を許可する範囲:',
    choices: RULE_CHOICES,
  });

  const { write } = await prompt({
    type: 'list',
    name: 'write',
    message: '汎用 API の書き込み操作 (create/update/delete 等) を許可する範囲:',
    choices: RULE_CHOICES,
  });

  return { apiAccess: { read, write } };
}
