/**
 * Claude API 接続確認スクリプト(読むだけ。1 回の短い問い合わせ)
 * 実行: pnpm ops claude test
 * モデル = アプリの AI エージェントの設定(src/config/app/ai-agent.config.ts の AI_AGENT_CONFIG.model)。
 *   アプリが使うモデルに届くかを確かめる(fork が設定を差し替えればそれを見る)
 */
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

import { AI_AGENT_CONFIG } from '@/config/app/ai-agent.config';

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
  const model = AI_AGENT_CONFIG.model;

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say OK' }],
    });

    const content = message.content[0];
    const text = content?.type === 'text' ? content.text : '';
    console.log(`✅ Claude API 連携成功(model: ${model})`);
    console.log('   Response:', text);
  } catch (error) {
    console.log(`❌ Claude API 連携失敗(model: ${model})`);
    console.log('   Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testConnection();
