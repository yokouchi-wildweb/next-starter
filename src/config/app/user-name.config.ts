// src/config/app/user-name.config.ts

/**
 * ユーザー表示名 (users.name) の設定
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
 * 2. 既存の重複を解消: pnpm cron user-name-dedup -- --dry-run で確認 → dry-run なしで実行
 */
export const USER_NAME_CONFIG = {
  /** 表示名の最大文字数 (サービス内での表示崩れ防止。露出面のデザインに合わせて調整可) */
  maxLength: 30,

  unique: {
    /** 表示名の重複を禁止するか (既定: 重複許容 = 従来挙動) */
    enabled: false,

    /** 大文字小文字を同一視して重複判定するか (例: "Taro" と "taro" を重複とみなす) */
    caseInsensitive: true,
  },
} as const;
