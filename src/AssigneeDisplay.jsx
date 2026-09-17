import React from "react";
import { TeamIcon } from "./teamIcons.jsx";

function normalizeProfiles(value) {
  const values = Array.isArray(value) ? value : String(value || "Não atribuído").split(/\s*,\s*/);
  const profiles = values.map((item) => typeof item === "object"
    ? { id: item.id || item.userId || item.name, name: String(item.name || "").trim() }
    : { id: item, name: String(item || "").trim() })
    .filter((profile) => profile.name);
  const unique = [...new Map(profiles.map((profile) => [profile.id || profile.name, profile])).values()];
  return unique.length ? unique : [{ id: "unassigned", name: "Não atribuído" }];
}

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ profile, small, className = "" }) {
  return <span className={`avatar ${small ? "avatar-small" : ""} ${className}`.trim()} aria-hidden="true">
    <span className="avatar-initials">{initials(profile.name)}</span>
  </span>;
}

export default function AssigneeDisplay({ value, small = false, team = null, teamName = "", primaryName = "", consultantNames = [] }) {
  if (team || teamName) {
    const label = team?.name || teamName || "Equipe responsável";
    return <span className="assignee-display assignee-display-team" title={`Equipe responsável: ${label}`} aria-label={`Equipe responsável: ${label}`}>
      <span className={`team-assignee-icon ${small ? "team-assignee-icon-small" : ""}`} aria-hidden="true"><TeamIcon name={team?.iconName} size={small ? 14 : 16} /></span>
      <span className="assignee-name">{label}</span>
    </span>;
  }
  const profiles = normalizeProfiles(value);
  const names = profiles.map((profile) => profile.name);
  const responsibilityNames = primaryName ? [primaryName, ...consultantNames] : names;
  const label = responsibilityNames.map((name) => String(name || "").trim().split(/\s+/)[0]).filter(Boolean).join(" | ") || "Não atribuído";

  return <span className="assignee-display" title={label} aria-label={`Responsáveis: ${label}`}>
    <Avatar profile={profiles[0]} small={small} />
    <span className="assignee-name">{label}</span>
  </span>;
}
