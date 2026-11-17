// src/features/core/messaging/services/server/templates/dto.ts
//
// 保存されたテンプレートの管理へ返す形(型だけ。client の service も型で読む)。中身 = カテゴリー + ひな形 + 欄の中身 + 専用の埋め込み情報(指令 58)。
// 経路は持たない: 送る経路は送る時のカテゴリーの経路

import type {
  MessageEmbeddedDeclaration,
  MessageEmbeddedSource,
  MessageLayoutFields,
  MessageLayoutSummary,
} from "@/lib/messaging";

import type { MessageTemplateStatus } from "../../../entities/model";

/** 画面が読む経路 1 つ(鍵・表示名)。送る画面の選択肢も同じ形。入力とプレビューはひな形の欄と描き方から(指令 59) */
export type AdminChannelOption = {
  key: string;
  label: string;
};

/** 埋め込み情報の一覧の 1 つ(画面の候補: 鍵・日本語の別名・出どころ・説明) */
export type AdminEmbeddedEntry = {
  key: string;
  alias: string;
  source: MessageEmbeddedSource;
  description: string | null;
};

/** 管理者が選べるひな形 1 つ(鍵・表示名・説明・欄の宣言) */
export type AdminTemplateLayoutOption = {
  key: string;
  label: string;
  description: string | null;
  version: number;
  fields: MessageLayoutFields;
};

export type AdminTemplateSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  /** 種類の表示名(受け口の label。受け口に無ければ null。画面は鍵でなくこれを出す、D46) */
  categoryLabel: string | null;
  status: MessageTemplateStatus;
  /** 最新の公開の版(null = まだ公開していない) */
  currentVersion: number | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  /** システムテンプレート(受け口 messaging/templates の白紙、D117・D125)。直せない・公開・取り下げできない(API が 409) */
  system: boolean;
  /** システムテンプレートの種別(DB のテンプレートは null) */
  kind: string | null;
  /** ひな形の鍵と欄の中身(DB のテンプレートは今の下書き、システムテンプレートは白紙) */
  layout: string;
  values: Record<string, unknown>;
};

export type AdminTemplateDetail = AdminTemplateSummary & {
  /** 保存した時のひな形の版 */
  layoutVersion: number;
  /** 専用の埋め込み情報の宣言(システムテンプレートは空) */
  embedded: MessageEmbeddedDeclaration[];
  /** 文面に書ける埋め込み情報の一覧(共通 + テンプレートに当たる enrichers + 専用) */
  catalog: AdminEmbeddedEntry[];
  /** 今の中身が最新の版と違う(公開していない変更がある。版が無ければ true) */
  hasUnpublishedChanges: boolean;
};

/** 公開した版(不変) */
export type AdminTemplateVersion = {
  version: number;
  layout: string;
  layoutVersion: number;
  values: Record<string, unknown>;
  embedded: MessageEmbeddedDeclaration[];
  category: string;
  /** 種類の表示名(受け口の label。無ければ null) */
  categoryLabel: string | null;
  editedBy: string | null;
  createdAt: string;
};

export type AdminTemplatePage = { items: AdminTemplateSummary[]; nextCursor: string | null };

/** 画面の選択肢(作る・直す画面が最初に読む) */
export type AdminTemplateOptions = {
  /** 使える経路(受け口にあり enabled: false でない物)。欄の表示の約束とプレビューの部品の鍵も(D83 D85) */
  channels: AdminChannelOption[];
  /** 種類(種別 announcement・direct・promotion の物だけ) */
  categories: {
    key: string;
    label: string;
    description: string | null;
    /** 種別(画面は種別 →(種類)の順に選ぶ、D115) */
    kind: string;
    /** その種類で送る経路の鍵(使える物だけ。プレビューのタブと経路だけの欄はこの分) */
    channels: string[];
  }[];
  /** 管理者が選べるひな形 */
  layouts: AdminTemplateLayoutOption[];
  /** 専用の宣言の前から書ける埋め込み情報(共通 + テンプレートに当たる enrichers) */
  baseCatalog: AdminEmbeddedEntry[];
};

/** ひな形のプレビュー(経路 1 つ。保存しない中身を送る口と同じ 3 段で描く、D114) */
export type AdminLayoutPreview = {
  channel: string;
  /** 経路の preview が描いた HTML(メール。preview の無い経路は null) */
  html: string | null;
  text: string | null;
  /** 件名・題(要約の題) */
  title: string | null;
  /** 要約(お知らせのカードの拠り所。作れなければ null) */
  summary: MessageLayoutSummary | null;
  /** 描けない理由(描ければ null) */
  cannotRender: string | null;
};
