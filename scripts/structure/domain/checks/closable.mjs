// 検査: closable(閉じられる形のひな形を頼む。render/featureGate)。
// features は pgTable を持つフォルダしか書けない(表の外し・汎用 API の住所の導出が効かない)ので、Firestore では止める

/**
 * @param {object} config domain.json
 * @returns {string[]} 問題(空なら無し)
 */
export function closableIssues(config) {
  const { closable } = config;
  if (closable === undefined) return [];
  if (typeof closable !== "boolean") return ["closable は true か false にしてください"];
  if (closable && config.dbEngine !== "Neon") return [`closable は Neon のドメインだけで使えます(今: ${JSON.stringify(config.dbEngine)}。Firestore の機能は規則を手で書く)`];
  return [];
}
