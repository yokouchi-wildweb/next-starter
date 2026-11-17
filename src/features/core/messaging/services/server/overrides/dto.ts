// src/features/core/messaging/services/server/overrides/dto.ts
//
// 管理画面の文言の上書きの返す形と入力(型だけ。client の service も型で読む)。
// 経路 = 連絡の種類の経路(fork の種類の上書きの後)。欄 = 連絡のひな形の欄のうち種類の経路で使う物の全部(既定で全部直せる、D132)を
// ひな形の宣言の順に平たく並べ、欄ごとに使う経路を持つ(経路のタブは欄の channels で絞る)

import type { MessageEmbeddedEntry, MessageFieldSpec, MessageLayoutSummary } from "@/lib/messaging";

/** 連絡の経路 1 つ(種類の経路の順) */
export type AdminOverrideChannel = {
  key: string;
  /** 経路の表示名(経路の受け口の label) */
  label: string;
};

/** 編集できる連絡の一覧の 1 行 */
export type AdminOverrideMessageSummary = {
  key: string;
  /** 連絡の名前(定義の label、fork の上書きの後。画面は鍵でなくこれを出す、D46) */
  label: string;
  kind: string;
  /** 種類(取引の連絡は無い = null) */
  category: string | null;
  /** 種類の表示名(受け口の label。受け口に無ければ null) */
  categoryLabel: string | null;
  /** 種類の経路(届ける経路) */
  channels: AdminOverrideChannel[];
  /** 直せる欄の数 */
  editableCount: number;
  /** 直した欄の数(使えない行も含む) */
  editedCount: number;
  /** 使えない行の数(版を移せない・今の検査を通らない。送る時はコードの値、行は残る) */
  unusableCount: number;
  /** コードが直した後に変わった欄の数 */
  codeChangedCount: number;
};

/** 欄の宣言(ひな形の欄の宣言から経路の印を除いた物: 型・見出し・仮の文・必須と型ごとの約束) */
export type AdminOverrideFieldSpec = Omit<MessageFieldSpec, "channels">;

/** 欄 1 つ(直せる欄 = ひな形の欄のうち種類の経路で使う物の全部(adminEditableOnly があればその中)、または使えない・直せなくなった行) */
export type AdminOverrideField = {
  /** 欄の道(ひな形の欄の鍵。使えない行は保存した時の鍵のまま) */
  path: string;
  /** 欄の宣言(ひな形に無い欄の行は null) */
  spec: AdminOverrideFieldSpec | null;
  /** この欄を使う経路(種類の経路の中、種類の経路の順。使えない行は空) */
  channels: string[];
  /** 今も直せる欄か(false = 直せなくなった・使えない行。既定に戻すだけできる) */
  editable: boolean;
  /** 今のコードの値(定義の values の欄、fork の override を重ねた後) */
  codeValue: unknown;
  /** 管理画面の値(行が無ければ null) */
  value: unknown;
  /** 送る時に使う値(当てられる管理画面の値、無ければコードの値) */
  effective: unknown;
  /** 行がある */
  edited: boolean;
  /** 直した時のコードの値と今のコードの値が違う */
  codeChanged: boolean;
  /** 行を当てられない(ひな形の版を移せない・今の検査を通らない。送る時はコードの値) */
  unusable: boolean;
  /** 使えない理由 */
  problem: string | null;
  updatedAt: string | null;
};

export type AdminOverrideMessageDetail = {
  key: string;
  /** 連絡の名前(定義の label、fork の上書きの後。画面は鍵でなくこれを出す、D46) */
  label: string;
  kind: string;
  /** 種類(取引の連絡は無い = null) */
  category: string | null;
  /** 種類の表示名(受け口の label。受け口に無ければ null) */
  categoryLabel: string | null;
  /** 使ってよい {{鍵}}(vars は秘密を除く・共通の文脈・provides) */
  allowedKeys: string[];
  /**
   * 埋め込み情報の一覧(部品 EmbeddedInfoTags が読む): 共通 + 当たる enrichers(日本語の別名つき)+ この連絡の vars(秘密を除く。
   * source "own"、別名なし = 鍵で書く)
   */
  embedded: MessageEmbeddedEntry[];
  /** 種類の経路(届ける経路、欄はこの順) */
  channels: AdminOverrideChannel[];
  fields: AdminOverrideField[];
};

/** 欄 1 つの保存(fieldPath = 今の版の欄の鍵) */
export type SaveMessageOverrideInput = { fieldPath: string; value: unknown };

/**
 * プレビューの結果(D86)。html = 連絡の描き方で描いた HTML(文字の欄に data-field="<欄の鍵>")、経路にプレビューが無ければ null。
 * layout / values / summary = ひな形の鍵・その経路が使う欄の中身(保存した値と下書きを重ねた物、印なし、{{鍵}} のまま)・要約
 * (お知らせは client のひな形の描き方 layoutInApps で描く)。要約を作れなければ summary null と cannotRender に理由
 */
export type MessageOverridePreview = {
  channel: string;
  html: string | null;
  text: string | null;
  layout: string;
  values: Record<string, unknown>;
  summary: MessageLayoutSummary | null;
  cannotRender: string | null;
};
