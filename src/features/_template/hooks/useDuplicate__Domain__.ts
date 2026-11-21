// src/features/__domain__/hooks/useDuplicate__Domain__.ts

"use client";

import { useDuplicateDomain } from "@/lib/crud";
import { __domain__Client } from "../services/client/__domain__Client";

export const useDuplicate__Domain__ = () => useDuplicateDomain("__domains__/duplicate", __domain__Client.duplicate!, "__domains__");
