import React, { useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";

const ACTIONS = [
  { id: "completed_tasks", label: "Apagar tasks concluídas", detail: "Remove somente as tasks com status concluído.", countKey: "completedTasks" },
  { id: "all_tasks", label: "Apagar todas as tasks", detail: "Remove todas as tasks e seus vínculos locais.", countKey: "tasks" },
  { id: "all_tags", label: "Apagar todas as tags", detail: "Remove tags pessoais e suas associações.", countKey: "personalTags" },
  { id: "notifications", label: "Limpar notificações", detail: "Remove todo o histórico local de notificações.", countKey: "notifications" },
];

export default function AdminCleanupPanel({ live, counts = {}, onCleanup }) {
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState({ user: "", password: "" });
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const login = (event) => {
    event.preventDefault();
    if (credentials.user === "admin" && credentials.password === "admin") {
      setAuthenticated(true);
      setError("");
      return;
    }
    setError("Usuário ou senha inválidos.");
  };

  const execute = async () => {
    if (!pendingAction || confirmText !== "EXCLUIR") return;
    setBusy(true);
    setError("");
    try {
      await onCleanup(pendingAction);
      setPendingAction("");
      setConfirmText("");
    } catch (failure) {
      setError(failure?.message || "Não foi possível concluir a limpeza.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel admin-cleanup-panel" aria-labelledby="admin-cleanup-title">
      <button className="admin-cleanup-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="setting-icon admin-cleanup-icon"><ShieldAlert size={19} /></span>
        <span><strong id="admin-cleanup-title">Ferramentas administrativas</strong><small>Limpeza controlada de dados do Planner</small></span>
        <span className="admin-cleanup-chevron">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="admin-cleanup-body">
        {!authenticated ? (
          <form className="admin-login" onSubmit={login}>
            <p>Entre para revelar as ações destrutivas {live ? "do Dataverse" : "deste navegador"}.</p>
            <div className="admin-login-fields">
              <label>Usuário<input autoComplete="username" value={credentials.user} onChange={(event) => setCredentials((value) => ({ ...value, user: event.target.value }))} /></label>
              <label>Senha<input type="password" autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials((value) => ({ ...value, password: event.target.value }))} /></label>
            </div>
            {error && <span className="drawer-error" role="alert">{error}</span>}
            <button className="button button-secondary" type="submit">Acessar ferramentas</button>
          </form>
        ) : (
          <div className="admin-action-list">
            <div className="admin-session"><span>Acesso administrativo liberado</span><button type="button" onClick={() => { setAuthenticated(false); setPendingAction(""); setConfirmText(""); }}>Sair</button></div>
            {ACTIONS.map((action) => <div className="admin-action-row" key={action.id}>
              <div><strong>{action.label}</strong><span>{action.detail}</span></div>
              <span className="admin-action-count">{counts[action.countKey] || 0}</span>
              <button className="button button-danger" type="button" onClick={() => { setPendingAction(action.id); setConfirmText(""); setError(""); }} disabled={!counts[action.countKey]}><Trash2 size={14} />Excluir</button>
            </div>)}
          </div>
        )}
        {pendingAction && <div className="admin-confirm" role="dialog" aria-modal="true" aria-label="Confirmar exclusão">
          <strong>Esta ação não pode ser desfeita.</strong><span>Digite <b>EXCLUIR</b> para confirmar.</span>
          <input autoFocus value={confirmText} onChange={(event) => setConfirmText(event.target.value)} aria-label="Digite EXCLUIR para confirmar" />
          <div><button className="button button-secondary" type="button" onClick={() => setPendingAction("")} disabled={busy}>Cancelar</button><button className="button button-danger" type="button" onClick={execute} disabled={confirmText !== "EXCLUIR" || busy}>{busy ? "Excluindo…" : "Confirmar exclusão"}</button></div>
        </div>}
        {authenticated && error && <span className="drawer-error" role="alert">{error}</span>}
      </div>}
    </section>
  );
}
