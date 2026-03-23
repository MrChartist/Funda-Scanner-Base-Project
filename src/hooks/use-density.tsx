import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type DensityMode = "compact" | "comfortable" | "spacious";

interface DensityContextType {
  density: DensityMode;
  setDensity: (mode: DensityMode) => void;
}

const DensityContext = createContext<DensityContextType>({
  density: "comfortable",
  setDensity: () => {},
});

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<DensityMode>(() => {
    return (localStorage.getItem("funda-density") as DensityMode) || "comfortable";
  });

  useEffect(() => {
    localStorage.setItem("funda-density", density);
    const root = document.documentElement;
    root.classList.remove("density-compact", "density-spacious");
    if (density !== "comfortable") {
      root.classList.add(`density-${density}`);
    }
  }, [density]);

  return (
    <DensityContext.Provider value={{ density, setDensity }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  return useContext(DensityContext);
}
