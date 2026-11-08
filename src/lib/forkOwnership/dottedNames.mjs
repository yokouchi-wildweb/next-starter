// src/lib/forkOwnership/dottedNames.mjs — 移った: 点つきの名前の分類は src/lib/districtMap/dottedNames.mjs(lib の import を forkOwnership → districtMap の一方向にするため)。
// この入口は出荷済みの codemod と fork の道具のために残す再 export だけ。新しいコードは移り先を読む。notice で予告した後の出荷で消す。
export * from "../districtMap/dottedNames.mjs";
