const DEFAULT_VIEW = "board";
const VALID_VIEWS = new Set([
  "dashboard",
  "team",
  "management",
  "quotes",
  "board",
  "list",
  "calendar",
  "more",
  "quality",
  "settings",
]);

function readDataParams(search = "") {
  const params = new URLSearchParams(search);
  const data = new URLSearchParams((params.get("data") || "").replace(/^\?/, ""));
  return { params, data };
}

export function readPlannerUrlState(search = "") {
  const { params, data } = readDataParams(search);
  const requestedView = params.get("view") || data.get("view") || DEFAULT_VIEW;
  return {
    view: VALID_VIEWS.has(requestedView) ? requestedView : DEFAULT_VIEW,
    taskId: params.get("taskId") || data.get("taskId") || "",
  };
}

export function plannerUrlForState(location, { view = DEFAULT_VIEW, taskId = "" }) {
  const { params, data } = readDataParams(location.search);

  if (view && view !== DEFAULT_VIEW) data.set("view", view);
  else data.delete("view");

  if (taskId) {
    data.set("taskId", taskId);
    data.delete("source");
    data.delete("sourceId");
    data.delete("mode");
  } else {
    data.delete("taskId");
  }

  params.delete("view");
  params.delete("taskId");
  const serializedData = data.toString();
  if (serializedData) params.set("data", serializedData);
  else params.delete("data");

  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash || ""}`;
}
