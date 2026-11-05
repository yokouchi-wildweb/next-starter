// src/components/Form/backgroundFailure.ts
// 裏の処理(メディアのアップロードなど)が失敗した欄があるときに送信を止める判定(AppForm)。
// 欄を AppForm に登録する部品(MediaHandleEntry)が hasFailed を返せば、メディア以外の非同期の欄も同じく止まる

/** 失敗の状態を持つもの(MediaHandleEntry・MediaState)。hasFailed が無い古い登録は失敗なしとして扱う */
type FailureLike = { hasFailed?: boolean } | null | undefined;

/** 失敗したままの欄が 1 つでもあるか */
export function hasBackgroundFailure(items: readonly FailureLike[]): boolean {
  return items.some((item) => Boolean(item?.hasFailed));
}

/** 送信を止めたときに出す文 */
export const BACKGROUND_FAILURE_MESSAGE = "アップロードに失敗した項目があります。やり直すか取り消してから保存してください";
