import React, { forwardRef } from "react";

const MAX_DATE = "9999-12-31";
const MAX_DATE_TIME = "9999-12-31T23:59";

export const DateInput = forwardRef(function DateInput({ type = "date", value = "", onInput, onChange, ...props }, ref) {
  const restoreOverlongYear = (event) => {
    if (!/^\d{5,}-/.test(event.currentTarget.value)) return false;
    event.currentTarget.value = value || "";
    return true;
  };

  return <input
    {...props}
    ref={ref}
    type={type}
    max={type === "datetime-local" ? MAX_DATE_TIME : MAX_DATE}
    value={value}
    onInput={(event) => { if (!restoreOverlongYear(event)) onInput?.(event); }}
    onChange={(event) => { if (!restoreOverlongYear(event)) onChange?.(event); }}
  />;
});
