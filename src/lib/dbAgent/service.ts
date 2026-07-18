// src/lib/dbAgent/service.ts
//
// DB調査エージェントのサービス関数。
// 汎用ランタイム (@/lib/ai/agent/runtime) に DB ツール一式とシステムプロンプトを
// 組み合わせ、監査 (ターン完了時の usage 記録) を配線する。

import "server-only";

import type { AgentChatMessage, AgentEvent } from "@/lib/ai";
import { runAgent } from "@/lib/ai/agent/runtime";
import { dbAgentSystemSuffixProviders } from "@/registry/dbAgentPromptRegistry";

import {
  DB_AGENT_AUDIT_ACTIONS,
  DB_AGENT_AUDIT_TARGET,
  type DbAgentAuditRecorder,
} from "./audit";
import { isDbAgentEnabled } from "./readonlyDb";
import { buildDbAgentSystemPrompt } from "./prompt";
import { buildDbAgentTools } from "./tools";

export { isDbAgentEnabled };

export type RunDbAgentOptions = {
  /** 会話履歴 (最後は user メッセージ) */
  messages: AgentChatMessage[];
  /** クライアント切断時の中断シグナル */
  signal?: AbortSignal;
  /**
   * 監査レコーダ (API ルートから auditLogger を注入する)。
   * SQL 実行ごとの記録とターン完了時の usage 記録に使う。
   */
  auditRecorder?: DbAgentAuditRecorder;
  /**
   * システムプロンプト末尾に付加する実行時サフィックス (直接呼び出し用)。
   * 通常経路 (管理画面の運営追加指示) は dbAgentSystemSuffixProviders レジストリを
   * 使うこと。両方ある場合はプロバイダ分の後ろに結合される。
   */
  systemSuffix?: string;
};

/**
 * レジストリ登録プロバイダから実行時サフィックスを解決する。
 * プロバイダの throw はスキップ (追加指示の欠落は機能停止より軽微。
 * 最終防衛線は read-only ツール境界)。
 */
async function resolveSystemSuffix(
  directSuffix?: string,
): Promise<string | undefined> {
  const parts: string[] = [];

  for (const provider of dbAgentSystemSuffixProviders) {
    try {
      const text = (await provider())?.trim();
      if (text) parts.push(text);
    } catch (error) {
      console.error("[dbAgent] system suffix provider failed:", error);
    }
  }

  const direct = directSuffix?.trim();
  if (direct) parts.push(direct);

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

/**
 * DB調査エージェントを実行し、AgentEvent を逐次 yield する。
 *
 * agent.done を検知してトークン使用量を監査ログへ記録する
 * (記録失敗はターンの成否に影響させない)。
 */
export async function* runDbAgent(
  options: RunDbAgentOptions,
): AsyncGenerator<AgentEvent, void, undefined> {
  const generator = runAgent({
    system: buildDbAgentSystemPrompt(
      await resolveSystemSuffix(options.systemSuffix),
    ),
    messages: options.messages,
    tools: buildDbAgentTools(options.auditRecorder),
    signal: options.signal,
  });

  for await (const event of generator) {
    if (event.type === "agent.done" && options.auditRecorder) {
      try {
        await options.auditRecorder.record({
          ...DB_AGENT_AUDIT_TARGET,
          action: DB_AGENT_AUDIT_ACTIONS.turnCompleted,
          metadata: { usage: event.usage },
        });
      } catch (error) {
        // usage 記録の失敗は回答配信を妨げない (SQL 実行時の記録とは別)
        console.error("[dbAgent] turn usage audit failed:", error);
      }
    }
    yield event;
  }
}
