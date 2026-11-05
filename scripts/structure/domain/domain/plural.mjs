// 生成器の単数 → 複数の推定（ここ 1 か所だけ）。語の規則は pluralize（devDependency）の表に任せ、手書きの規則は持たない。
// domain.json の plural があればそちらが常に優先（呼び出し側で判断）。ここは plural が無いとき・関係先の名前を作るときの推定。
// pluralize の不規則・不可算の表は語全体にしか効かない（user_media → user_medias）ので、最後の語だけを取り出して複数形にする。
// 新しい語の誤りは手の規則を足さず、この下で pluralize.addIrregularRule / addUncountableRule / addPluralRule を呼んで直す。

import pluralize from "pluralize";

// 最後の語の前で区切る: snake / kebab の区切り、または camel の境目（小文字・数字の後の大文字）
const LAST_SEGMENT = /^(.*(?:[_-]|[a-z0-9](?=[A-Z])))?([^_-]+)$/;

function restoreCase(source, word) {
  if (source === source.toUpperCase() && source.length > 1) return word.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}

/**
 * 名前の最後の語だけを複数形にする（区切りと大文字小文字はそのまま）。
 * 例: card_set → card_sets / sampleCategory → sampleCategories / CardSet → CardSets / user_media → user_media
 * @param {string} name
 * @returns {string}
 */
export function toPlural(name) {
  if (!name) return name;
  const match = LAST_SEGMENT.exec(name);
  if (!match) return pluralize(name);
  const head = match[1] ?? "";
  const last = match[2];
  return head + restoreCase(last, pluralize(last.toLowerCase()));
}
