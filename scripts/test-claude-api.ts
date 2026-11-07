/**
 * Claude API 接続確認スクリプト
 * 実行: pnpm claude:test
 */
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

// ENV_FILE で指定された環境ファイルを読み込む（デフォルト: .env.development）
const envFile = process.env.ENV_FILE || '.env.development';
dotenv.config({ path: envFile });

async function testConnection() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('❌ ANTHROPIC_API_KEY が設定されていません');
    console.log('   .env.development に以下を追加してください:');
    console.log('   ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say OK' }],
    });

    const content = message.content[0];
    const text = content.type === 'text' ? content.text : '';
    console.log('✅ Claude API 連携成功');
    console.log('   Response:', text);
  } catch (error) {
    console.log('❌ Claude API 連携失敗');
    console.log('   Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testConnection();
