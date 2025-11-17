import inquirer from 'inquirer';
const prompt = inquirer.createPromptModule();

async function askDbEngine() {
  const { dbEngine } = await prompt({
    type: 'list',
    name: 'dbEngine',
    message: '利用する DB を選択:',
    choices: [
      { name: 'Neon', value: 'Neon' },
      { name: 'Firestore', value: 'Firestore' },
    ],
  });
  return dbEngine;
}

async function askIdType() {
  const { idType } = await prompt({
    type: 'list',
    name: 'idType',
    message: 'ID の種類を選択:',
    choices: [
      { name: 'UUID', value: 'uuid' },
      { name: 'Custom string', value: 'string' },
      { name: 'Custom number', value: 'number' },
      { name: 'DB-generated', value: 'db' },
    ],
  });
  return idType;
}

export default async function askBasics() {
  const dbEngine = await askDbEngine();
  const idType = await askIdType();
  return { dbEngine, idType };
}
