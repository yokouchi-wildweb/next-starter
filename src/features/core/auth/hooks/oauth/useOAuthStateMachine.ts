/**
 * OAuthフローのステートマシン
 */

import { useReducer, useCallback } from "react";
import type { OAuthState, OAuthAction, OAuthPhase, OAuthCredentialInfo } from "./types";

const initialState: OAuthState = {
  phase: "initial",
  credentialInfo: null,
  error: null,
  requiresReactivation: false,
};

function oauthReducer(state: OAuthState, action: OAuthAction): OAuthState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.payload };
    case "SET_CREDENTIAL":
      return { ...state, credentialInfo: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, phase: "invalidProcess" };
    case "SET_REQUIRES_REACTIVATION":
      return { ...state, requiresReactivation: action.payload };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

/**
 * OAuthフローのステート管理フック
 */
export function useOAuthStateMachine() {
  const [state, dispatch] = useReducer(oauthReducer, initialState);

  const setPhase = useCallback((phase: OAuthPhase) => {
    dispatch({ type: "SET_PHASE", payload: phase });
  }, []);

  const setCredential = useCallback((credential: OAuthCredentialInfo) => {
    dispatch({ type: "SET_CREDENTIAL", payload: credential });
  }, []);

  const setError = useCallback((error: Error) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const setRequiresReactivation = useCallback((value: boolean) => {
    dispatch({ type: "SET_REQUIRES_REACTIVATION", payload: value });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    phase: state.phase,
    credentialInfo: state.credentialInfo,
    error: state.error,
    requiresReactivation: state.requiresReactivation,
    setPhase,
    setCredential,
    setError,
    setRequiresReactivation,
    clearError,
    reset,
  } as const;
}
