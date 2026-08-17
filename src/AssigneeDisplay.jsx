import React from "react";

function normalizeProfiles(value) {
  const values = Array.isArray(value) ? value : String(value || "Não atribuído").split(/\s*,\s*/);
  const profiles = values.map((item) => typeof item === "object"
    ? { id: item.id || item.userId || item.name, name: String(item.name || "").trim(), avatarUrl: item.avatarUrl || item.imageUrl || "" }
    : { id: item, name: String(item || "").trim(), avatarUrl: "" })
    .filter((profile) => profile.name);
  const unique = [...new Map(profiles.map((profile) => [profile.id || profile.name, profile])).values()];
  return unique.length ? unique : [{ id: "unassigned", name: "Não atribuído", avatarUrl: "" }];
}

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ profile, small, className = "" }) {
  return <span className={`avatar ${small ? "avatar-small" : ""} ${className}`.trim()} aria-hidden="true">
    {profile.avatarUrl && <img className="avatar-image" src={profile.avatarUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
    <span className="avatar-initials">{initials(profile.name)}</span>
  </span>;
}

function AvatarStack({ profiles, small }) {
  return <span className={`avatar avatar-stack ${small ? "avatar-stack-small" : ""}`} aria-hidden="true">
    {profiles.map((profile, index) => <Avatar profile={profile} small={small} className="avatar-stack-item" key={`${profile.id || profile.name}-${index}`} />)}
  </span>;
}

export default function AssigneeDisplay({ value, small = false }) {
  const profiles = normalizeProfiles(value);
  const names = profiles.map((profile) => profile.name);
  const label = names.join(", ") || "Não atribuído";
  const isUnassigned = profiles.length === 1 && /^não atribuído$/i.test(profiles[0].name);

  if (names.length === 1) return <span className="assignee-display" title={label} aria-label={`Responsável: ${label}`}>
    <Avatar profile={profiles[0]} small={small} />
    <span className="assignee-name">{label}</span>
  </span>;

  return <span className="assignee-display assignee-display-multiple" title={label} aria-label={`Responsáveis: ${label}`}>
    <AvatarStack profiles={profiles} small={small} />
  </span>;
}
