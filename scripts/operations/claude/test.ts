/**
 * Claude API 接続確認スクリプト(読むだけ。1 回の短い問い合わせ)
 * 実行: pnpm ops claude test
 * モデル = アプリの AI エージェントの設定(@/lib/ai の aiConfig.model、上書き src/config/lib/ai.config.ts)。
 *   アプリが使うモデルに届くかを確かめる(fork が設定を差し替えればそれを見る)
 */
import Anthropic from '@anthropic-ai/sdk';

import { aiConfig } from '@/lib/ai';

import { guardEntry } from '../../runner/guard';

// 共通の守り(読む入口: 向き先と段階の印だけ。scripts/runner/guard)
const { envFile } = guardEntry({ write: false, what: 'pnpm ops claude test' });

async function testConnection() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('❌ ANTHROPIC_API_KEY が設定されていません');
    console.log('   .env.development に以下を追加してください:');
    console.log('   ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  const client = new Anthropic();
  const model = aiConfig.model;

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
