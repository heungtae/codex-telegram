import { createContext, useContext } from "react";

export type AppRuntimeValue = {
  domains: object;
  runtime: object;
  presentation: object;
};

export const AppRuntimeContext = createContext<AppRuntimeValue | null>(null);

function useAppRuntimeValue() {
  const value = useContext(AppRuntimeContext);
  if (!value) {
    throw new Error("App runtime context must be used within AppRuntimeProvider.");
  }
  return value;
}

export function useAppDomainsContext<T extends object>() {
  return useAppRuntimeValue().domains as T;
}

export function useAppRuntimeContext<T extends object>() {
  return useAppRuntimeValue().runtime as T;
}

export function useAppPresentationContext<T extends object>() {
  return useAppRuntimeValue().presentation as T;
}
