// src/features/core/user/services/server/registration/index.ts

// 本登録
export * from "./registerFromAuth";
export * from "./activate";
export * from "./sendRegistrationCompleteMail";

// 外部の認証の身元から引く・作る (新しい認証手段の公開の口)
export * from "./createFromProvider";

// 仮登録
export * from "./preRegisterFromAuth";
export * from "./setPending";
