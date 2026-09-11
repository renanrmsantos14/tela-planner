import React, { useMemo } from "react";
import { UserRound, Users } from "lucide-react";
import {
  responsibilityFromIds,
  resolveTaskAssignment,
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
  const employeeOptions = employees
    .filter((employee) => employee?.id && employee?.name)
    .map((employee) => ({ value: employee.id, label: employee.name }));
  const teamOptions = teams.filter((team) => (team.memberIds || []).length > 0).map((team) => ({
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
  const primaryAssigneeId = form.primaryAssigneeId || form.assigneeId || form.assigneeIds?.[0] || "";
  const selectedConsultantIds = (form.consultantIds || (form.assigneeIds || []).filter((id) => String(id) !== String(primaryAssigneeId)))
    .filter((id) => String(id) !== String(primaryAssigneeId));
  const primaryName = employeeById.get(String(primaryAssigneeId))?.name || "Não definido";
  const consultantNames = selectedConsultantIds
    .map((id) => employeeById.get(String(id))?.name)
    .filter(Boolean);
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
      primaryAssigneeId: "",
      consultantIds: [],
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
    const assignment = resolveTaskAssignment({ assignmentMode: "team", teamIds: selectedIds }, teams, employees);
    setForm((current) => ({
      ...current,
      assignmentMode: "team",
      teamIds: selectedIds,
      teamNames: selected.map((team) => team.name),
      teamId: selectedIds[0] || "",
      teamName: selected.map((team) => team.name).join(", "),
      assigneeIds: assignment.assigneeIds,
      assigneeName: assignment.assigneeNames,
      primaryAssigneeId: assignment.primaryAssigneeId,
      consultantIds: assignment.consultantIds,
    }));
  };
  const commitPeople = (primaryId, consultantIds) => {
    const responsibility = responsibilityFromIds([primaryId, ...(consultantIds || [])], primaryId);
    const selectedNames = responsibility.assigneeIds.map((id) => employeeById.get(String(id))?.name).filter(Boolean);
    setForm((current) => ({
      ...current,
      assignmentMode: "people",
      teamIds: [],
      teamNames: [],
      teamId: "",
      teamName: "",
      assigneeName: selectedNames,
      assigneeIds: responsibility.assigneeIds,
      primaryAssigneeId: responsibility.primaryAssigneeId,
      consultantIds: responsibility.consultantIds,
    }));
  };
  const selectPrimary = (id) => commitPeople(id, selectedConsultantIds);
  const selectConsultants = (ids) => commitPeople(primaryAssigneeId, Array.isArray(ids) ? ids : []);
  return (
    <div className="assignment-field">
      <div className="assignment-field-header">
        <span>{assignmentMode === "team" ? "Equipe" : "Responsável"}</span>
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
              <span className="assignment-members-label">Composição herdada da equipe</span>
              <div className="assignment-members-list">
                {primaryName !== "Não definido" && (
                  <span
                    className="assignment-member-chip assignment-member-primary"
                  >
                    <span className="avatar avatar-small">
                      {String(primaryName)
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    Principal: {primaryName}
                  </span>
                )}
                {consultantNames.length > 0 && (
                  <span className="assignment-member-chip">
                    Consultores: {consultantNames.join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <label className="assignment-control">
            <span className="sr-only">Responsável principal</span>
            <InputSelect
            value={primaryAssigneeId}
            onChange={selectPrimary}
            options={employeeOptions}
            placeholder="Escolha quem responde pela task"
          />
          </label>
          <label className="assignment-control">
            <span>Consultores</span>
            <InputSelect
              value={selectedConsultantIds}
              onChange={selectConsultants}
              options={employeeOptions.filter((option) => String(option.value) !== String(primaryAssigneeId))}
              placeholder={primaryAssigneeId ? "Adicione consultores" : "Escolha o principal primeiro"}
              disabled={!primaryAssigneeId}
              multiple
            />
          </label>
        </>
      )}
    </div>
  );
}
