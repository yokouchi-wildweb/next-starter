// src/features/__domain__/hooks/useHardDelete__Domain__.ts

"use client";

import { useHardDeleteDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";

export const useHardDelete__Domain__ = () => useHardDeleteDomain("__domains__/hard-delete", __domain__Client.hardDelete, "__domains__");
