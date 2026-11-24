// scripts/runner/phases/offlineEnv.mjs — offline の段階(build・build:post)の check から外す env の名前(DB・外部のサービス)
// 読み手: ./run.mjs(子の env から外す)・scripts/structure/extensions/select.mjs(外される名前の欠けを見ない)。import を持たない(読むだけで副作用が無い)
export const OFFLINE_ENV = /^(DATABASE_URL.*|MY_SERVICE_ACCOUNT_KEY|NEXT_PUBLIC_FIREBASE_.*|FIREBASE_.*|GOOGLE_APPLICATION_CREDENTIALS|GCS_.*|ANTHROPIC_API_KEY|RESEND_.*|SENDGRID_.*|SMTP_.*|CLOUDFLARE_.*)$/;
