import React from "react";

function normalizeNames(value) {
  const values = Array.isArray(value) ? value : String(value || "Não atribuído").split(/\s*,\s*/);
  const names = [...new Set(values.map((name) => String(name || "").trim()).filter(Boolean))];
  return names.length ? names : ["Não atribuído"];
}

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function AvatarStack({ names, small }) {
  const visibleNames = names.slice(0, 2);
  return <span className={`avatar avatar-stack ${small ? "avatar-stack-small" : ""}`} aria-hidden="true">
    {visibleNames.map((name, index) => <span className="avatar avatar-stack-item" key={`${name}-${index}`}>{initials(name)}</span>)}
    {names.length > visibleNames.length && <span className="avatar avatar-stack-count">+{names.length - visibleNames.length}</span>}
  </span>;
}

export default function AssigneeDisplay({ value, small = false, compact = false }) {
  const names = normalizeNames(value);
  const label = names.join(", ") || "Não atribuído";
  const isUnassigned = names.length === 1 && /^não atribuído$/i.test(names[0]);
  const countLabel = isUnassigned ? "Não atribuído" : `${names.length} responsáveis`;

  if (names.length === 1) return <span className="assignee-display" title={label} aria-label={`Responsável: ${label}`}>
    <span className={`avatar ${small ? "avatar-small" : ""}`}>{initials(names[0])}</span>
    <span className="assignee-name">{label}</span>
  </span>;

  return <span className={`assignee-display assignee-display-multiple ${compact ? "assignee-display-compact" : ""}`} title={label} aria-label={`Responsáveis: ${label}`}>
    <AvatarStack names={names} small={small} />
    <span className="assignee-copy"><strong>{countLabel}</strong>{!compact && <small>{names[0]}{names.length > 1 ? ` +${names.length - 1}` : ""}</small>}</span>
  </span>;
}
