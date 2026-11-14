"use client";

// src/features/core/messaging/hooks/useModalSession.ts
//
// 管理のモーダル(テンプレート・文言の上書き)の「開いた回」の番号。閉じた → 開いた の度に 1 増える。
// 入れ物は書く欄を持つ中身をこの番号で key して、開き直すたびに書きかけを捨てる(閉じる間は中身を残し、閉じる動きを崩さない)。
// 開いたことを effect で写さず、描く途中で前の open と比べて直す(React の「props が変わった時に state を直す」形)

import { useState } from "react";

export function useModalSession(open: boolean): number {
  const [session, setSession] = useState(open ? 1 : 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession(session + 1);
  }
  return session;
}
