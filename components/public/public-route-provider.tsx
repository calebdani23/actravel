"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { LocalizedAlternatePaths } from "@/lib/i18n/public-routes";

type PublicRouteContextValue = {
  alternatePaths: LocalizedAlternatePaths | null;
  setAlternatePaths: (alternatePaths: LocalizedAlternatePaths | null) => void;
};

const PublicRouteContext = createContext<PublicRouteContextValue | null>(null);

export function PublicRouteProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [alternatePaths, setAlternatePaths] = useState<LocalizedAlternatePaths | null>(null);
  const value = useMemo(() => ({ alternatePaths, setAlternatePaths }), [alternatePaths]);

  return <PublicRouteContext.Provider value={value}>{children}</PublicRouteContext.Provider>;
}

export function usePublicRouteAlternates() {
  const context = useContext(PublicRouteContext);

  if (!context) {
    throw new Error("usePublicRouteAlternates must be used inside PublicRouteProvider");
  }

  return context;
}

export function PublicRouteAlternates({ alternatePaths }: Readonly<{ alternatePaths: LocalizedAlternatePaths }>) {
  const { setAlternatePaths } = usePublicRouteAlternates();

  useEffect(() => {
    setAlternatePaths(alternatePaths);

    return () => {
      setAlternatePaths(null);
    };
  }, [alternatePaths, setAlternatePaths]);

  return null;
}
