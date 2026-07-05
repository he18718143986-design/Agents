import { useEffect, useState } from "react";
import { isDebugEnabled } from "./debugLog";

export function useDebugEnabled(): boolean {
  const [debugOn, setDebugOn] = useState(() => isDebugEnabled());

  useEffect(() => {
    const sync = () => setDebugOn(isDebugEnabled());
    window.addEventListener("stagent-debug-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("stagent-debug-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return debugOn;
}
