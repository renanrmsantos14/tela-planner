import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, BellRing, CalendarDays, CheckCircle2, Clock3, RotateCcw, Users, UserRound } from "lucide-react";
import { formatDate, getDueBucket } from "./domain.js";
import { collectionRows, localDateKey, waitingRows, workloadGroups, workloadTotals } from "./management.js";

function daysLabel(days) {
  return days === 1 ? "1 dia" : `${days} dias`;
}

function duePresentation(task) {
  const bucket = getDueBucket(task);
  if (bucket === "overdue") return { label: "Atrasada", className: "is-overdue", Icon: AlertTriangle };
  if (bucket === "today") return { label: "Hoje", className: "is-today", Icon: CalendarDays };
  if (bucket === "tomorrow") return { label: "Amanhã", className: "is-tomorrow", Icon: Clock3 };
  if (bucket === "upcoming") return { label: "Próxima", className: "is-upcoming", Icon: Clock3 };
  return { label: "Sem prazo", className: "is-no-due", Icon: CalendarDays };
}

export default function ManagementView({ state, onOpenTask, onCollect, onRegisterWaitingReturn, onCreate }) {
  const [tab, setTab] = useState("collection");
  const collections = useMemo(() => collectionRows(state.tasks, state.employees, state.teams, state.collectionEvents, new Date()), [state.tasks, state.employees, state.teams, state.collectionEvents]);
  const workload = useMemo(() => workloadGroups(state.tasks, state.teams, new Date()), [state.tasks, state.teams]);
  const workloadTotal = useMemo(() => workloadTotals(state.tasks, new Date()), [state.tasks]);
  const waiting = useMemo(() => waitingRows(state.tasks, state.teams, new Date()), [state.tasks, state.teams]);
  const collectionToday = localDateKey();
  return <div className="page-content management-page">
    <div className="page-header">
      <div><span className="eyebrow">GESTÃO OPERACIONAL</span><h1>Acompanhamento</h1><p>Veja onde o trabalho está parado e cobre o próximo movimento.</p></div>
      <button className="button button-primary" type="button" onClick={onCreate}>Nova tarefa</button>
    </div>
    <div className="management-tabs" role="tablist" aria-label="Visões de gestão">
      <button type="button" role="tab" aria-selected={tab === "collection"} className={tab === "collection" ? "is-active" : ""} onClick={() => setTab("collection")}><BellRing size={16} />Cobrança <b>{collections.length}</b></button>
      <button type="button" role="tab" aria-selected={tab === "workload"} className={tab === "workload" ? "is-active" : ""} onClick={() => setTab("workload")}><Users size={16} />Carga <b>{workload.length}</b></button>
      <button type="button" role="tab" aria-selected={tab === "waiting"} className={tab === "waiting" ? "is-active" : ""} onClick={() => setTab("waiting")}><RotateCcw size={16} />Retornos <b>{waiting.length}</b></button>
    </div>
    {tab === "collection" && <CollectionTable rows={collections} today={collectionToday} onOpenTask={onOpenTask} onCollect={onCollect} />}
    {tab === "workload" && <WorkloadTable groups={workload} totals={workloadTotal} onOpenTask={onOpenTask} />}
    {tab === "waiting" && <WaitingTable rows={waiting} onOpenTask={onOpenTask} onRegisterWaitingReturn={onRegisterWaitingReturn} />}
  </div>;
}

function CollectionTable({ rows, today, onOpenTask, onCollect }) {
  return <section className="panel management-panel"><div className="panel-heading"><div><span className="eyebrow">PRAZO ESTOURADO</span><h2>Central de cobrança</h2></div><span className="panel-count">{rows.length}</span></div>{rows.length ? <div className="management-list">{rows.map((row) => <article className="management-row" key={row.id}><div className="management-row-main"><strong>{row.title}</strong><span>{row.assignmentLabel}: {row.assigneeNames.join(", ") || "Sem responsável"}</span><small>Criada por {row.creatorName}</small></div><div className="management-row-due"><strong className="danger-text">{daysLabel(row.overdueDays)} em atraso</strong><span><CalendarDays size={14} />{formatDate(row.dueDate)}</span>{row.lastCollectionAt && <small>Última cobrança: {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(row.lastCollectionAt))}</small>}</div><div className="management-row-actions"><button className="button button-secondary button-small" type="button" onClick={() => onOpenTask(row.id)}><ArrowUpRight size={14} />Abrir</button><button className="button button-primary button-small" type="button" disabled={row.collectionDate === today} onClick={() => onCollect(row.id)}>{row.collectionDate === today ? "Cobrada hoje" : "Cobrar agora"}</button></div></article>)}</div> : <EmptyState icon={CheckCircle2} title="Nenhuma tarefa atrasada" detail="A Central de cobrança está em dia." />}</section>;
}

function WorkloadTable({ groups, totals, onOpenTask }) {
  const [expandedGroups, setExpandedGroups] = useState({});
  return <section className="panel management-panel"><div className="panel-heading"><div><span className="eyebrow">VOLUME ATIVO</span><h2>Carga por responsabilidade</h2><p className="panel-subtitle">Total geral: <strong>{totals.unique} tarefas únicas</strong> · {totals.today} vencem hoje · {totals.overdue} atrasadas. Uma tarefa compartilhada aparece em cada responsável.</p></div></div>{groups.length ? <div className="workload-grid">{groups.map((group) => { const isExpanded = Boolean(expandedGroups[group.key]); const visibleTasks = isExpanded ? group.tasks : group.tasks.slice(0, 5); const remaining = group.tasks.length - visibleTasks.length; return <article className={`workload-card${isExpanded ? " is-expanded" : ""}`} key={group.key}><div className="workload-card-heading"><span className="workload-icon">{group.type === "team" ? <Users size={17} /> : <UserRound size={17} />}</span><div><strong>{group.label}</strong><small>{group.type === "team" ? "Equipe" : "Pessoa"}</small></div><b aria-label={`${group.total} tarefas abertas`}>{group.total}</b></div><div className="workload-stats"><span><strong>{group.open}</strong> abertas</span><span><strong>{group.today}</strong> hoje</span><span className={group.overdue ? "danger-text" : ""}><strong>{group.overdue}</strong> atrasadas</span></div><div className="workload-task-list">{visibleTasks.map((task) => { const due = duePresentation(task); const DueIcon = due.Icon; const dueText = task.dueDate ? `${due.label} · ${formatDate(task.dueDate)}` : due.label; return <button className={`management-inline-link workload-task-link ${due.className}`} key={task.id} title={`Abrir tarefa: ${task.title}`} aria-label={`Abrir tarefa ${task.title}. ${dueText}`} type="button" onClick={() => onOpenTask(task.id)}><span className="workload-task-copy"><span className="workload-task-icon" aria-hidden="true"><DueIcon size={14} /></span><span className="workload-task-title">{task.title}</span></span><span className="workload-task-due">{dueText}</span><ArrowUpRight size={14} /></button>; })}</div>{group.tasks.length > 5 && <button className="workload-more" type="button" aria-expanded={isExpanded} onClick={() => setExpandedGroups((current) => ({ ...current, [group.key]: !isExpanded }))}>{isExpanded ? "Mostrar menos" : `Ver mais ${remaining} ${remaining === 1 ? "tarefa" : "tarefas"}`}<ArrowUpRight size={14} /></button>}</article>; })}</div> : <EmptyState icon={Users} title="Nenhuma carga ativa" detail="As tarefas abertas aparecerão por pessoa ou equipe." />}</section>;
}

function WaitingTable({ rows, onOpenTask, onRegisterWaitingReturn }) {
  return <section className="panel management-panel"><div className="panel-heading"><div><span className="eyebrow">DEPENDÊNCIAS</span><h2>Retornos vencidos e sem previsão</h2></div><span className="panel-count">{rows.length}</span></div>{rows.length ? <div className="management-list">{rows.map((row) => <article className="management-row" key={row.id}><div className="management-row-main"><strong>{row.title}</strong><span>Aguardando {row.waitingTarget}</span><small>{row.waitingTargetType === "external" ? "Parte externa" : "Parte interna"}</small></div><div className="management-row-due"><strong className={row.waitingExpectedDate ? "danger-text" : "warning-text"}>{row.waitingExpectedDate ? `${daysLabel(row.waitingOverdueDays)} vencido` : "Sem previsão"}</strong><span>{row.waitingExpectedDate ? formatDate(row.waitingExpectedDate) : "Defina uma data"}</span></div><div className="management-row-actions"><button className="button button-secondary button-small" type="button" onClick={() => onOpenTask(row.id)}><ArrowUpRight size={14} />Abrir</button>{onRegisterWaitingReturn && <button className="button button-primary button-small" type="button" onClick={() => onRegisterWaitingReturn(row.id)}>Registrar retorno</button>}</div></article>)}</div> : <EmptyState icon={CheckCircle2} title="Nenhum retorno pendente" detail="Dependências vencidas e sem previsão aparecerão aqui." />}</section>;
}

function EmptyState({ icon: Icon, title, detail }) {
  return <div className="management-empty"><Icon size={26} /><strong>{title}</strong><span>{detail}</span></div>;
}
