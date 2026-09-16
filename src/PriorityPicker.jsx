import React from "react";
import { Flag } from "lucide-react";
import { PRIORITIES } from "./domain";

export default function PriorityPicker({ value, onChange, includeUrgent = false }) {
  const options = includeUrgent ? PRIORITIES : PRIORITIES.filter((item) => item.id !== "urgent");
  const selectedItem = options.find((item) => item.id === value) || options[0];
  return <div className="priority-picker" role="group" aria-label={`Prioridade atual: ${selectedItem.label}`}>
    <div className="priority-picker-options" style={includeUrgent ? { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" } : undefined}>
      {options.map((item) => {
        const isSelected = value === item.id;
        return <button key={item.id} type="button" className={`priority-option priority-option-${item.tone}${isSelected ? " is-selected" : ""}`} aria-label={item.label} aria-pressed={isSelected} title={item.label} onClick={() => onChange(item.id)}>
          <Flag size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>;
      })}
    </div>
    <span className={`priority-picker-current priority-current-${selectedItem.tone}`}>{selectedItem.label}</span>
  </div>;
}
