const VIEW_KEY = "betinhos-quotes-hybrid-v3-view";

export function readQuoteViewPreference(storage) {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(VIEW_KEY) === "list" ? "list" : "kanban";
  } catch {
    return "kanban";
  }
}

export function saveQuoteViewPreference(view, storage) {
  if (view !== "list" && view !== "kanban") return;
  try {
    (storage ?? globalThis.localStorage)?.setItem(VIEW_KEY, view);
  } catch {
    // A preferência é opcional quando o armazenamento está indisponível.
  }
}
