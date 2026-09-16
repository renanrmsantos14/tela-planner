import { useEffect, useState } from "react";
import { loadQuoteServiceTypes } from "./dataverse.js";
import { DEFAULT_SERVICE_TYPES } from "./quoteServiceTypes.js";

export function useQuoteServiceTypes() {
  const [options, setOptions] = useState(DEFAULT_SERVICE_TYPES.map((name, index) => ({ id: `mock-${index}`, name, archived: false, order: index })));
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => loadQuoteServiceTypes().then((types) => { if (active) { setOptions(types); setError(""); } }).catch((failure) => { if (active) setError(failure.message); });
    refresh();
    window.addEventListener("planner-service-types-changed", refresh);
    return () => { active = false; window.removeEventListener("planner-service-types-changed", refresh); };
  }, []);
  return { options, error };
}
