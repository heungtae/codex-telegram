import type { ReactNode } from "react";
import { AppRuntimeContext } from "./AppRuntimeContext";
import type { AppRuntimeValue } from "./AppRuntimeContext";

export default function AppRuntimeProvider({
  children,
  value,
}: {
  children?: ReactNode;
  value: AppRuntimeValue;
}) {
  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}
