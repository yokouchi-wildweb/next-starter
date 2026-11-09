// src/features/core/user/config.ts
// 利用者の設定(既定 + 上書き)。上書きは src/config/features/user.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。fork 独自の鍵は上書きで `export type Extra = { <鍵>: <型> }` を宣言して値を書く
// 休会・退会・ユーザータグの入切は src/config/app/app-features.config.ts(門番の議会が移す)

import override, { type Extra } from "@/config/features/user.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/**
 * サインアップモード
 * - normal: 通常登録
 * - earlyRegistration: 事前登録
 */
export type SignupMode = "normal" | "earlyRegistration";

/** セレクションテーブルの選択方式 */
export type SelectionBehavior = "row" | "checkbox";

/** 一括更新(userService.bulkUpdateByIds / bulkUpdate)で更新できる列(副作用の無い列だけ、UserCoreSchema の項目名) */
export type UserBulkUpdateField = "adminMemo" | "user_tag_ids";

/** マイページのアカウントで利用者が変えられる項目(画面 /mypage/account/<項目>) */
export type AccountEditableItem = "email" | "password" | "profile" | "phone";

export type UserConfig = {
  /** サインアップモード: "normal"=通常登録, "earlyRegistration"=事前登録 */
  signupMode: SignupMode;
  /** アバター画像の変更機能を有効にする */
  avatarEnabled: boolean;
  /** ユーザー管理モーダルを有効にする（false の場合は削除ボタンのみ表示） */
  enableUserManagement: boolean;
  /**
   * 管理者メモ機能を有効にする
   * - true: 管理画面のユーザー一覧（General/Managerial/Demo）にメモ列が表示され、
   *         セル内のポップオーバーから自由記述メモを編集できる
   * - false: メモ列は表示されない（DB の users.admin_memo 列は残存）
   */
  enableUserMemo: boolean;
  /** ユーザー一覧ページの挙動設定 */
  userListPage: {
    /** セレクションテーブルの選択方式 */
    selectionBehavior: SelectionBehavior;
    /** バルクアクションバーを常に表示する */
    bulkActionsAlwaysVisible: boolean;
    /** セレクションテーブルを有効にするユーザー種別 */
    enableSelectionTable: { general: boolean; managerial: boolean; demo: boolean };
  };
  /**
   * アカウントロックアウト(連続ログイン失敗に対する 2 段階防御)
   * - 短期ロック: shortLockThreshold 回失敗で shortLockDurationSeconds 秒間ロック (時間経過で自動解除)
   * - 永続ロック: permanentLockThreshold 回失敗で status=security_locked (管理者解除のみ)
   *
   * 失敗カウントは下記契機でリセット:
   * - ログイン成功
   * - パスワードリセット完了
   * - 管理者による security_locked 解除
   * - 直近失敗から countResetWindowSeconds 秒以上経過後の新たな失敗 (時間窓ベース)
   *
   * 短期ロック中は認証処理ごと即ブロックし、カウントは増分しない
   * (攻撃者が永続ロックへの到達を意図的に早められないため)。
   */
  authLockout: {
    /** 短期ロック発動の累積失敗回数 */
    shortLockThreshold: number;
    /** 永続ロック発動の累積失敗回数 (status=security_locked へ遷移) */
    permanentLockThreshold: number;
    /** 短期ロックの継続時間 (秒) */
    shortLockDurationSeconds: number;
    /** 直近失敗からの経過時間がこれを超えると累積カウントを 0 にリセット (秒) */
    countResetWindowSeconds: number;
  };
  /**
   * ユーザーの一括更新（userService.bulkUpdateByIds / bulkUpdate）。
   * fields に無い列は 400 で拒否する。表示名・ステータス・ロール・メール・電話番号・パスワード・isDemo は
   * wrappers の処理が要るので足さない。
   */
  bulkUpdate: {
    fields: readonly UserBulkUpdateField[];
    maxIds: number;
  };
  /**
   * ユーザー表示名 (users.name)。※「ユーザー名」「表示名 (display name)」は同一フィールド
   *
   * 文字数・文字種のバリデーションは常時適用され、サインアップ・マイページ・
   * 管理画面のすべての書き込み経路で共有スキーマ (user/entities/userName.ts) が使われる。
   *
   * 一意性 (重複禁止) はアプリケーションレイヤで検証する。DB unique 制約を使わない理由:
   * - 運用途中に有効化する際、既存の重複データがあるとインデックス作成自体が失敗する
   *   (アプリ制御なら「既存は黙認、以後の書き込みのみ検証」という移行が可能)
   * - ソフトデリート済みユーザーの名前を再利用できなくなる
   * - 大文字小文字の同一視などの正規化ポリシーを設定で差し替えられない
   * check→write 間の同時実行レースは pg_advisory_xact_lock で直列化して塞いでいる
   * (user/services/server/helpers/nameAvailability.ts)。
   *
   * 有効化手順 (詳細: src/features/core/user/README.md):
   * 1. unique.enabled を true に変更してデプロイ
   * 2. 既存の重複を解消: pnpm task user:name-dedup -- --dry-run で確認 → dry-run なしで実行
   */
  name: {
    /** 表示名の最大文字数 (サービス内での表示崩れ防止。露出面のデザインに合わせて調整可) */
    maxLength: number;
    unique: {
      /** 表示名の重複を禁止するか (既定: 重複許容 = 従来挙動) */
      enabled: boolean;
      /** 大文字小文字を同一視して重複判定するか (例: "Taro" と "taro" を重複とみなす) */
      caseInsensitive: boolean;
    };
  };
  /** 利用者の更新の検証に失敗したときの文(スキーマが自前の文を書いていない項目に使う) */
  updateValidation: {
    fallbackMessage: string;
  };
  /** マイページのアカウント */
  account: {
    /**
     * 利用者が変えられる項目(アカウントのトップのメニューに出し、各画面はこの一覧に無ければトップへ戻す)。
     * 配列は丸ごと置き換え。password はメール登録の利用者だけ、phone は SMS 認証の機能 phoneVerification が開のときだけ出る
     */
    editableItems: readonly AccountEditableItem[];
  };
};

const defaults: UserConfig = {
  signupMode: "normal",
  avatarEnabled: false,
  enableUserManagement: true,
  enableUserMemo: false,
  userListPage: {
    selectionBehavior: "row",
    bulkActionsAlwaysVisible: true,
    enableSelectionTable: {
      general: true,
      managerial: false,
      demo: false,
    },
  },
  authLockout: {
    shortLockThreshold: 5,
    permanentLockThreshold: 15,
    shortLockDurationSeconds: 30 * 60,
    countResetWindowSeconds: 24 * 60 * 60,
  },
  bulkUpdate: {
    fields: ["adminMemo", "user_tag_ids"],
    maxIds: 1000,
  },
  name: {
    maxLength: 30,
    unique: {
      enabled: false,
      caseInsensitive: true,
    },
  },
  updateValidation: {
    fallbackMessage: "入力内容を確認してください。",
  },
  account: {
    editableItems: ["email", "password", "profile"],
  },
};

export const userConfigDef = defineConfig(defaults, { label: "user" });

/** 上書きのファイルの型(`export default { ... } satisfies UserOverride<Extra>`) */
export type UserOverride<E extends object = Record<never, never>> = OverrideOf<typeof userConfigDef, E>;

/** 合成済みの設定(上流の値 + 上書き、fork が Extra で足した鍵も入る) */
export const userConfig: UserConfig & Extra = userConfigDef.compose<Extra>(override);
