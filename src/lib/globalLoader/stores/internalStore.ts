// src/lib/globalLoader/stores/internalStore.ts
// 出している分を手形ごとに持つ(出した順の並び)。1 つでも残る間は出し続け、文と見た目は残っている中で最後に出した物(D111・D114)

"use client";

import { create } from "zustand";
import type { ReactNode } from "react";
import type { LoaderSpinnerVariant } from "../spinner";

export type LoaderOptions = {
  message?: ReactNode;
  spinnerVariant?: LoaderSpinnerVariant;
  spinnerClassName?: string;
  messageClassName?: string;
  className?: string;
};

/** 出している 1 件(id = 手形) */
type LoaderEntry = { id: number; options: LoaderOptions };

type GlobalLoaderState = {
  entries: readonly LoaderEntry[];
  /** 出す分を足して手形を返す */
  add: (options: LoaderOptions) => number;
  /** 手形の分を外す(もう無ければ何もしない) */
  remove: (id: number) => void;
};

let nextId = 1;

export const internalStore = create<GlobalLoaderState>((set) => ({
  entries: [],
  add: (options) => {
    const id = nextId++;
    set((state) => ({ entries: [...state.entries, { id, options }] }));
    return id;
  },
  remove: (id) =>
    set((state) => (state.entries.some((entry) => entry.id === id) ? { entries: state.entries.filter((entry) => entry.id !== id) } : state)),
}));
