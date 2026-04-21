import { useContext } from "react";
import { ClinicContext } from "../context/ClinicContextValue";

export function useClinicContext() {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error("useClinicContext must be used inside <ClinicProvider />");
  }
  return context;
}
