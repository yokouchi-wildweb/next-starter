// 生成器（render/）の戻り値の形。render/ はファイルに触らず、この Output の配列を返す。
// 実際の書き込みと「書いた / 保持した」のメッセージ出力は pipeline/apply.mjs が行う。
// 書く前に全カテゴリの Output を集められるので、途中で検査に失敗しても書きかけのファイルが残らない。

/**
 * @typedef {object} FileOutput 毎回上書きするファイル
 * @property {"file"} kind
 * @property {string} path 絶対パス
 * @property {string} content
 * @property {string} [label] 書いた後に出すメッセージの接頭辞（例: "コンポーネントを生成しました"）。無ければ出さない
 * @property {string} [unchangedLabel] 内容が同じなら書かずにこのメッセージを出す（例: "変更なし"）
 *
 * @typedef {object} WriteOnceOutput 無いときだけ書くファイル（write-once）
 * @property {"writeOnce"} kind
 * @property {string} path
 * @property {string} content
 * @property {string} [label] 新規に書いたときのメッセージ
 * @property {string} [keptLabel] 既存を保持したときのメッセージ
 * @property {(existing: string) => string[]} [warnOnKeep] 既存を保持したとき、内容に応じて出す警告
 * @property {{ test: (existing: string) => boolean, label: string }} [migrate] 既存が旧形式なら一度だけ書き直す
 *
 * @typedef {object} DirOutput 無いときだけ作るディレクトリ（中に keepFile を置く）。既にあれば中身に触らない
 * @property {"dir"} kind
 * @property {string} path
 * @property {string} [keepFile] 作ったときに置く空ファイル名（例: ".gitkeep"）
 *
 * @typedef {object} PatchOutput 既存ファイルの一部を書き換える（レジストリ）。ファイルが無ければ何もしない
 * @property {"patch"} kind
 * @property {string} path
 * @property {(text: string) => { text?: string, logs?: string[], warns?: string[] }} apply text を返せば書き込む（返さなければ書かない）
 *
 * @typedef {object} LogOutput メッセージだけ（書き込みなし）
 * @property {"log"} kind
 * @property {string} message
 *
 * @typedef {FileOutput | WriteOnceOutput | DirOutput | PatchOutput | LogOutput} Output
 */

export function file(path, content, { label, unchangedLabel } = {}) {
  return { kind: "file", path, content, label, unchangedLabel };
}

export function writeOnce(path, content, { label, keptLabel, warnOnKeep, migrate } = {}) {
  return { kind: "writeOnce", path, content, label, keptLabel, warnOnKeep, migrate };
}

export function dir(path, { keepFile } = {}) {
  return { kind: "dir", path, keepFile };
}

export function patch(path, apply) {
  return { kind: "patch", path, apply };
}

export function log(message) {
  return { kind: "log", message };
}
