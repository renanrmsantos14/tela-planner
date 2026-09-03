import React, { useMemo } from "react";
import { UserRound, Users } from "lucide-react";
import {
  buildEmployeeAssigneeOptions,
} from "./domain.js";
import SearchableSelect, {
  SearchableMultiSelect,
} from "./SearchableSelect.jsx";

export function InputSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione",
  disabled = false,
  multiple = Array.isArray(value),
}) {
  const normalizedOptions = useMemo(
    () =>
      options.map((option) =>
        typeof option === "string" ? { value: option, label: option } : option,
      ),
    [options],
  );
  const remoteSearch = options.find(
    (option) => typeof option?._remoteSearch === "function",
  )?._remoteSearch;
  return multiple ? (
    <SearchableMultiSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      options={normalizedOptions}
    />
  ) : (
    <SearchableSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      options={normalizedOptions}
      onQueryChange={remoteSearch}
    />
  );
}

export default function AssignmentFields({
  form,
  setForm,
  employees = [],
  teams = [],
}) {
  const assignmentMode = form.assignmentMode === "team" ? "team" : "people";
  const employeeById = new Map(
    employees.map((employee) => [String(employee.id), employee]),
  );
  const employeeOptions = buildEmployeeAssigneeOptions(employees).map((name) => ({
    value: name,
    label: name,
  }));
  const teamOptions = teams.map((team) => ({
    value: team.id,
    label: team.name,
    subtitle: String((team.memberIds || []).length) +
      ((team.memberIds || []).length === 1 ? " membro" : " membros"),
  }));
  const selectedTeamIds = Array.isArray(form.teamIds)
    ? form.teamIds
    : form.teamId
      ? [form.teamId]
      : [];
  const selectedTeams = teams.filter((team) =>
    selectedTeamIds.some((id) => String(id) === String(team.id)),
  );
  const selectedMemberNames = [
    ...new Set(
      (form.assigneeIds || [])
        .map((id) => employeeById.get(String(id))?.name)
        .filter(Boolean),
    ),
  ];
  const selectedMemberLabels = selectedMemberNames.map((name) =>
    employees.find((employee) => employee.name === name)?.apelido || name,
  );
  const selectMode = (mode) => {
    setForm((current) => ({
      ...current,
      assignmentMode: mode === "team" ? "team" : "people",
      teamIds: [],
      teamNames: [],
      teamId: "",
      teamName: "",
      assigneeName: [],
      assigneeIds: [],
    }));
  };
  const selectTeam = (teamIds) => {
    const selectedIds = Array.isArray(teamIds)
      ? teamIds
      : teamIds
        ? [teamIds]
        : [];
    const selected = teams.filter((team) =>
      selectedIds.some((id) => String(id) === String(team.id)),
    );
    const memberIds = [
      ...new Set(selected.flatMap((team) => team.memberIds || [])),
    ];
    setForm((current) => ({
      ...current,
      assignmentMode: "team",
      teamIds: selectedIds,
      teamNames: selected.map((team) => team.name),
      teamId: selectedIds[0] || "",
      teamName: selected.map((team) => team.name).join(", "),
      assigneeIds: memberIds,
      assigneeName: memberIds
        .map((id) => employeeById.get(String(id))?.name)
        .filter(Boolean),
    }));
  };
  const selectPeople = (names) => {
    const selectedNames = Array.isArray(names) ? names : [];
    setForm((current) => ({
      ...current,
      assignmentMode: "people",
      teamIds: [],
      teamNames: [],
      teamId: "",
      teamName: "",
      assigneeName: selectedNames,
      assigneeIds: selectedNames
        .map((name) => employees.find((employee) => employee.name === name)?.id)
        .filter(Boolean),
    }));
  };
  return (
    <div className="assignment-field">
      <div className="assignment-field-header">
        <span>{assignmentMode === "team" ? "Equipe" : "Responsáveis"}</span>
        <div
          className="assignment-mode"
          role="group"
          aria-label="Tipo de atribuição"
        >
          <button
            type="button"
            className={assignmentMode === "people" ? "is-selected" : ""}
            aria-label="Pessoas"
            title="Pessoas"
            aria-pressed={assignmentMode === "people"}
            onClick={() => selectMode("people")}
          >
            <UserRound size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={assignmentMode === "team" ? "is-selected" : ""}
            aria-label="Equipe"
            title="Equipe"
            aria-pressed={assignmentMode === "team"}
            onClick={() => selectMode("team")}
          >
            <Users size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      {assignmentMode === "team" ? (
        <>
          <label className="assignment-control">
            <span className="sr-only">Equipe</span>
            <InputSelect
              value={selectedTeamIds}
              onChange={selectTeam}
              options={teamOptions}
              placeholder={
                teams.length
                  ? "Selecione uma ou mais equipes"
                  : "Nenhuma equipe cadastrada"
              }
              disabled={!teams.length}
              multiple
            />
          </label>
          {selectedTeams.length > 0 && (
            <div
              className="assignment-members"
              aria-label={
                "Membros de " + selectedTeams.map((team) => team.name).join(", ")
              }
            >
              <span className="assignment-members-label">
                Responsáveis destas equipes
              </span>
              <div className="assignment-members-list">
                {selectedMemberLabels.map((member, index) => (
                  <span
                    className="assignment-member-chip"
                    key={String(member) + "-" + index}
                  >
                    <span className="avatar avatar-small">
                      {String(member)
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    {member}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <label className="assignment-control">
          <span className="sr-only">Responsáveis</span>
          <InputSelect
            value={form.assigneeName || []}
            onChange={selectPeople}
            options={employeeOptions}
            placeholder="Selecione uma ou mais pessoas"
            multiple
          />
        </label>
      )}
    </div>
  );
}
