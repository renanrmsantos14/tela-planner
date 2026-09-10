import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, Clock3, LoaderCircle, Smartphone, Send } from "lucide-react";

export const NOTIFICATION_TEST_TYPES = [
  { id: "digest_daily", label: "Resumo diário", description: "Teste de push diário" },
  { id: "digest_weekly", label: "Resumo semanal", description: "Teste de push de segunda" },
  { id: "update", label: "Atualização", description: "Alteração geral na tarefa" },
  { id: "mention", label: "Menção", description: "Teste de aviso de menção" },
  { id: "deadline", label: "Prazo", description: "Teste de mudança de prazo" },
  { id: "status", label: "Status", description: "Teste de mudança de status" },
];

const DEFAULT_MESSAGE = "Teste de notificação do Planner.";

function firstTestableTask(tasks) {
  return tasks.find((task) => !["done", "cancelled"].includes(task.status)) || tasks[0];
}

export default function NotificationTestPanel({ live, tasks = [], onSend }) {
  const [taskId, setTaskId] = useState("");
  const [testType, setTestType] = useState("digest_daily");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const availableTasks = useMemo(() => tasks.filter((task) => task?.id), [tasks]);

  useEffect(() => {
    if (!availableTasks.some((task) => task.id === taskId)) setTaskId(firstTestableTask(availableTasks)?.id || "");
  }, [availableTasks, taskId]);

  const submit = async () => {
    if (!live || !taskId || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      const result = await onSend({ taskId, type: testType, message });
      setFeedback(result?.text
        ? { type: result.type || "pending", text: result.text }
        : { type: "pending", text: "Evento criado, mas o Planner ainda não confirmou o disparo." });
    } catch (error) {
      setFeedback({ type: "error", text: error?.message || "Não foi possível enviar o teste." });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="panel notification-test-panel" aria-labelledby="notification-test-title">
      <div className="notification-test-heading">
        <div className="notification-test-heading-icon" aria-hidden="true"><BellRing size={18} /></div>
        <div>
          <span className="eyebrow">Operação controlada</span>
          <h2 id="notification-test-title">Módulo de teste de notificações mobile</h2>
          <p>Dispare um evento real para validar o push do Power Apps Mobile usando o usuário Microsoft conectado.</p>
        </div>
        <span className="notification-test-target"><Smartphone size={14} /> Power Apps Mobile</span>
      </div>
      <div className="notification-test-body">
        {!live && <div className="notification-test-local-note"><AlertTriangle size={15} /> Conecte o Planner ao Dataverse para habilitar o envio real.</div>}
        <div className="notification-test-fields">
          <label className="notification-test-field">
            <span>Tarefa de referência</span>
            <select value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={!live || sending || !availableTasks.length}>
              {!availableTasks.length && <option value="">Nenhuma tarefa disponível</option>}
              {availableTasks.map((task) => <option key={task.id} value={task.id}>{task.title || "Tarefa sem título"}</option>)}
            </select>
          </label>
          <label className="notification-test-field">
            <span>Mensagem do teste</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={500} disabled={!live || sending} />
          </label>
        </div>
        <div className="notification-test-type-group">
          <span className="notification-test-label">Tipo de notificação</span>
          <div className="notification-test-type-options" role="radiogroup" aria-label="Tipo de notificação">
            {NOTIFICATION_TEST_TYPES.map((type) => (
              <button key={type.id} className={`notification-test-type${testType === type.id ? " is-selected" : ""}`} type="button" role="radio" aria-checked={testType === type.id} onClick={() => setTestType(type.id)} disabled={!live || sending}>
                <strong>{type.label}</strong><small>{type.description}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="notification-test-footer">
          {feedback && <div className={`notification-test-feedback is-${feedback.type}`} role={feedback.type === "error" || feedback.type === "warning" ? "alert" : "status"}>
            {feedback.type === "success" ? <CheckCircle2 size={15} /> : feedback.type === "pending" ? <Clock3 size={15} /> : <AlertTriangle size={15} />}
            {feedback.text}
          </div>}
          <button className="button button-primary" type="button" onClick={submit} disabled={!live || !taskId || sending || !message.trim()}>
            {sending ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}
            {sending ? "Enviando…" : "Enviar push de teste"}
          </button>
        </div>
      </div>
    </section>
  );
}
