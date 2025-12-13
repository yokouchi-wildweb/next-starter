// src/features/__domain__/hooks/useRestore__Domain__.ts

"use client";

import { useRestoreDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";

export const useRestore__Domain__ = () => useRestoreDomain("__domains__/restore", __domain__Client.restore, "__domains__");
