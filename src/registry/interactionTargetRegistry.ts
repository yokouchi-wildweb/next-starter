// src/registry/interactionTargetRegistry.ts
//
// 公開 ingest ルート（POST /api/interactions）が受け付ける計測対象の登録簿。
// serviceRegistry と同じ「中央レジストリを下流が編集する」方式（サーバー専用）。
//
// fail-closed: ここに登録されていない targetType は ingest で拒否される。
// 存在しない対象・非公開対象へのカウント水増しを防ぐため、validate では
// 「対象が実在し、かつ計測を受け付けてよい状態か」（例: 公開済みか）を必ず検証すること。
//
// 登録例（下流ドメイン）:
//   bulletin: {
//     allowedActions: ["click", "link_click"],
//     validate: async (targetId) => {
//       const bulletin = await bulletinService.get(targetId).catch(() => null);
//       return !!bulletin?.is_published;
//     },
//   },

/** 計測対象 1 種別ぶんの受け入れルール */
export type InteractionTargetRule = {
  /**
   * 対象の実在・受け入れ可否の検証（サーバー側で必ず実行される）。
   * true を返した場合のみ記録される。例外は拒否として扱われる
   */
  validate: (targetId: string) => Promise<boolean>;
  /** 許可する action の語彙。省略時は任意の action を許可（validate は必須のまま） */
  allowedActions?: readonly string[];
  /** この targetType のイベント明細の保持日数（省略時は defaultRetentionDays） */
  retentionDays?: number;
  /**
   * イベント明細（interaction_events）を記録するか。既定 true。
   * false にすると集計（累計 + 日次）のみ加算する。
   * 「誰が」の追跡が不要で流量の多い targetType 向け（userId も記録されなくなる）
   */
  recordDetail?: boolean;
  /**
   * バッチ ingest（POST /api/interactions/batch）で受け付ける action の語彙。
   * 省略時はバッチ経路を一切受け付けない（fail-closed）。
   *
   * バッチ経路は count をまとめて申告できるため、クリック等の「1操作=1加算」で
   * 守りたい action をここに含めないこと。インプレッション等の高頻度・
   * 集計のみでよい action だけを列挙する（例: ["impression"]）。
   * バッチ経路は明細を書かない（常に集計のみ・userId も記録しない）
   */
  batchActions?: readonly string[];
};

export const interactionTargetRegistry: Record<string, InteractionTargetRule> = {
  // --- ここに計測対象を登録する（上流は空。下流が追記） ---
};
