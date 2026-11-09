// 検査: closable(閉じられる形の印)は受けない(D26)。閉じられるかはどれかの機能(門番の規則)の features に載るかで決まり、
// 1 対 1 のひな形(規則・入切の値)を生成器が書く仕組みはなくした。古い印は生成の前に止め、規則の書き方を案内する

/**
 * @param {object} config domain.json
 * @returns {string[]} 問題(空なら無し)
 */
export function closableIssues(config) {
  if (!Object.prototype.hasOwnProperty.call(config, "closable")) return [];
  return [
    'closable(閉じられる形の印)はなくなった(D26)。domain.json から消す。機能として閉じるなら src/featureGate/rules/<機能の名前>.ts に規則を書き、features にこのドメインのフォルダを入れる(書き方と例: src/featureGate/README.md「規則の書き方」)',
  ];
}
