import { normalizeAssigneeNames, STATUSES } from "./domain.js";
import { notificationDedupeKey, notificationRecipients } from "./notifications.js";

export const STORAGE_KEY = "betinhos-tela-planner-mock-v2";

const dateFromToday = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const MOCK_IMAGE_PREVIEWS = {
  vehicle: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="#dce7e8"/><rect y="390" width="960" height="250" fill="#b4c5c6"/><circle cx="150" cy="130" r="76" fill="#f5c56b"/><path d="M0 420 Q180 300 360 405 T720 380 T960 410 V640 H0Z" fill="#82999a"/><rect x="180" y="300" width="600" height="145" rx="28" fill="#172b35"/><path d="M270 300 L360 215 H600 L690 300Z" fill="#274753"/><rect x="385" y="235" width="185" height="62" rx="8" fill="#9bb8bd"/><circle cx="310" cy="450" r="58" fill="#15232a"/><circle cx="650" cy="450" r="58" fill="#15232a"/><circle cx="310" cy="450" r="25" fill="#ccd7d8"/><circle cx="650" cy="450" r="25" fill="#ccd7d8"/><text x="44" y="570" fill="#ffffff" font-family="Arial" font-size="30" font-weight="700">EVIDÊNCIA · VEÍCULO EXECUTIVO</text></svg>')}`,
  document: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="#f1eee8"/><rect x="225" y="62" width="510" height="516" rx="12" fill="#ffffff" stroke="#d4cbbd" stroke-width="5"/><rect x="275" y="125" width="260" height="22" rx="11" fill="#253d46"/><rect x="275" y="190" width="410" height="13" rx="6" fill="#d9d4cb"/><rect x="275" y="225" width="350" height="13" rx="6" fill="#d9d4cb"/><rect x="275" y="290" width="410" height="115" rx="9" fill="#e8f0ed"/><path d="M320 360 l48 -48 35 31 52 -59 77 81" fill="none" stroke="#2d796f" stroke-width="13"/><circle cx="590" cy="160" r="30" fill="#d9a441"/><text x="275" y="490" fill="#68777a" font-family="Arial" font-size="25">COMPROVANTE DE SERVIÇO</text></svg>')}`,
};

export function seedState() {
  const quotes = [
    { id: "quote-1008", code: "COT-1008", title: "Transfer executivo · Aeroporto GRU", client: "Grupo Horizonte", status: "Em análise", deadline: dateFromToday(0), value: "R$ 1.280,00" },
    { id: "quote-1007", code: "COT-1007", title: "Van executiva · Evento corporativo", client: "Norte & Sul Eventos", status: "Aguardando fornecedor", deadline: dateFromToday(2), value: "R$ 4.950,00" },
    { id: "quote-1006", code: "COT-1006", title: "Carro blindado · Diretoria", client: "Alvorada Capital", status: "Em análise", deadline: dateFromToday(1), value: "R$ 2.400,00" },
    { id: "quote-1005", code: "COT-1005", title: "Recepção de convidados · Congonhas", client: "Casa 9 Produções", status: "Respondida", deadline: dateFromToday(-1), value: "R$ 860,00" },
    { id: "quote-1004", code: "COT-1004", title: "Roadshow executivo · São Paulo e Campinas", client: "Vértice Tecnologia", status: "Nova", deadline: dateFromToday(3), value: "R$ 8.740,00" },
    { id: "quote-1003", code: "COT-1003", title: "Traslado de palestrantes · Expo Center Norte", client: "Mosaico Eventos", status: "Em análise", deadline: dateFromToday(4), value: "R$ 3.260,00" },
    { id: "quote-1002", code: "COT-1002", title: "Disposição diária · Alphaville", client: "Lumen Energia", status: "Aguardando fornecedor", deadline: dateFromToday(5), value: "R$ 6.180,00" },
    { id: "quote-1001", code: "COT-1001", title: "Transfer internacional · GRU–Faria Lima", client: "Kairós Health", status: "Nova", deadline: dateFromToday(1), value: "R$ 1.960,00" },
    { id: "quote-0999", code: "COT-0999", title: "Transporte de equipe · Guarujá", client: "Aurora Produções", status: "Respondida", deadline: dateFromToday(-3), value: "R$ 5.480,00" },
    { id: "quote-0998", code: "COT-0998", title: "Transfer para conselho · Itaim Bibi", client: "Orbe Consultoria", status: "Em análise", deadline: dateFromToday(0), value: "R$ 2.150,00" },
    { id: "quote-0997", code: "COT-0997", title: "Operação de embarque · Viracopos", client: "Delta Foods", status: "Nova", deadline: dateFromToday(6), value: "R$ 3.890,00" },
    { id: "quote-0996", code: "COT-0996", title: "Apoio logístico · Hotel Fasano", client: "Estação 21", status: "Respondida", deadline: dateFromToday(-5), value: "R$ 1.740,00" },
    { id: "quote-0995", code: "COT-0995", title: "Transfer de executivos · São José dos Campos", client: "Nexa Industrial", status: "Nova", deadline: dateFromToday(7), value: "R$ 4.620,00" },
    { id: "quote-0994", code: "COT-0994", title: "Frota dedicada · Convenção anual", client: "Pilar Seguros", status: "Em análise", deadline: dateFromToday(8), value: "R$ 12.900,00" },
    { id: "quote-0993", code: "COT-0993", title: "Recepção VIP · Hotel Unique", client: "Leste Mídia", status: "Aguardando fornecedor", deadline: dateFromToday(2), value: "R$ 2.780,00" },
    { id: "quote-0992", code: "COT-0992", title: "Transfer noturno · Santos–GRU", client: "Maré Logística", status: "Nova", deadline: dateFromToday(9), value: "R$ 2.340,00" },
    { id: "quote-0991", code: "COT-0991", title: "Veículo executivo · Diretoria regional", client: "Horizon Bio", status: "Respondida", deadline: dateFromToday(-7), value: "R$ 7.350,00" },
  ];
  const tasks = [
    task("task-1", "Preparar proposta comercial", "quote-1008", "COT-1008", "Transfer executivo · Aeroporto GRU", "doing", "high", "Marina Alves", "Comercial", dateFromToday(0), "Revisar composição de preço e confirmar janela de embarque."),
    task("task-2", "Confirmar disponibilidade de veículo", "quote-1007", "COT-1007", "Van executiva · Evento corporativo", "waiting", "medium", "Rafael Lima", "Operação", dateFromToday(2), "Aguardando confirmação do parceiro para a segunda van."),
    task("task-3", "Validar margem da proposta", "quote-1008", "COT-1008", "Transfer executivo · Aeroporto GRU", "todo", "medium", "Camila Torres", "Financeiro", dateFromToday(1), "Validar margem mínima antes de enviar ao cliente.", "task-1"),
    task("task-4", "Selecionar motorista de apoio", "quote-1006", "COT-1006", "Carro blindado · Diretoria", "todo", "high", "João Mendes", "Operação", dateFromToday(1), "Separar duas opções de motorista habilitado.", "task-5"),
    task("task-5", "Montar cotação do carro blindado", "quote-1006", "COT-1006", "Carro blindado · Diretoria", "doing", "high", "Marina Alves", "Comercial", dateFromToday(1), "Compor o valor final com deslocamento e espera."),
    task("task-6", "Registrar resposta enviada", "quote-1005", "COT-1005", "Recepção de convidados · Congonhas", "done", "low", "Camila Torres", "Comercial", dateFromToday(-1), "Resposta enviada e registrada no histórico."),
    task("task-7", "Validar causa do erro operacional", null, "QAL-204", "Atraso na confirmação do fornecedor", "waiting", "high", "Rafael Lima", "Qualidade", dateFromToday(1), "Confirmar causa e registrar ação corretiva.", null, { sourceType: "quality", sourceId: "quality-error-204", sourceLabel: "Erro operacional", sourceCode: "QAL-204" }),
    task("task-8", "Abrir ordem de serviço do roadshow", "quote-1004", "COT-1004", "Roadshow executivo · São Paulo e Campinas", "todo", "high", "Marina Alves", "Operação", dateFromToday(3), "Criar a OS com as quatro janelas de atendimento e pontos de apoio."),
    task("task-9", "Conferir rota São Paulo–Campinas", "quote-1004", "COT-1004", "Roadshow executivo · São Paulo e Campinas", "doing", "high", "João Mendes", "Operação", dateFromToday(2), "Validar pedágios, tempo de deslocamento e janela de retorno.", "task-8"),
    task("task-10", "Solicitar dados dos passageiros", "quote-1004", "COT-1004", "Roadshow executivo · São Paulo e Campinas", "waiting", "medium", "Camila Torres", "Comercial", dateFromToday(1), "Consolidar nomes, celulares e restrições alimentares.", "task-8"),
    task("task-11", "Confirmar credenciamento dos palestrantes", "quote-1003", "COT-1003", "Traslado de palestrantes · Expo Center Norte", "doing", "medium", "Camila Torres", "Comercial", dateFromToday(3), "Conferir horários de chegada e saída com produção."),
    task("task-12", "Reservar van de 15 lugares", "quote-1003", "COT-1003", "Traslado de palestrantes · Expo Center Norte", "todo", "high", "Rafael Lima", "Operação", dateFromToday(2), "Bloquear veículo com porta-malas compatível com equipamentos.", "task-11"),
    task("task-13", "Revisar diária em Alphaville", "quote-1002", "COT-1002", "Disposição diária · Alphaville", "waiting", "medium", "Marina Alves", "Financeiro", dateFromToday(4), "Recalcular hora extra e franquia de quilometragem."),
    task("task-14", "Validar motorista bilíngue", "quote-1001", "COT-1001", "Transfer internacional · GRU–Faria Lima", "todo", "high", "João Mendes", "Operação", dateFromToday(1), "Confirmar inglês fluente e experiência com passageiros estrangeiros."),
    task("task-15", "Enviar condições comerciais", "quote-0998", "COT-0998", "Transfer para conselho · Itaim Bibi", "doing", "high", "Marina Alves", "Comercial", dateFromToday(0), "Enviar proposta com política de espera e cancelamento."),
    task("task-16", "Registrar aceite do cliente", "quote-0999", "COT-0999", "Transporte de equipe · Guarujá", "done", "medium", "Camila Torres", "Comercial", dateFromToday(-2), "Aceite registrado por e-mail e repassado para a operação."),
    task("task-17", "Conferir placa e documentação", "quote-0999", "COT-0999", "Transporte de equipe · Guarujá", "done", "high", "Rafael Lima", "Operação", dateFromToday(-2), "Documentos conferidos antes do embarque.", "task-16"),
    task("task-18", "Acompanhar retorno sobre embarque", "quote-0997", "COT-0997", "Operação de embarque · Viracopos", "todo", "medium", "Rafael Lima", "Operação", dateFromToday(5), "Confirmar terminal, acesso e contato do coordenador local."),
    task("task-19", "Enviar comprovante de serviço", "quote-0996", "COT-0996", "Apoio logístico · Hotel Fasano", "done", "low", "Camila Torres", "Financeiro", dateFromToday(-4), "Comprovante enviado e anexado ao histórico.")
  ];
  const recurringTasks = [
    ["20", "Conferir janela de chegada no terminal", "quote-0995", "todo", "medium", "Rafael Lima", "Operação", 7],
    ["21", "Validar cobrança de pedágios", "quote-0995", "todo", "low", "Camila Torres", "Financeiro", 8],
    ["22", "Montar escala da convenção", "quote-0994", "doing", "high", "João Mendes", "Operação", 6],
    ["23", "Confirmar quantidade de veículos", "quote-0994", "waiting", "high", "Rafael Lima", "Operação", 5],
    ["24", "Revisar contrato de disponibilidade", "quote-0994", "todo", "medium", "Marina Alves", "Comercial", 8],
    ["25", "Enviar briefing para recepção VIP", "quote-0993", "doing", "medium", "Camila Torres", "Comercial", 1],
    ["26", "Confirmar equipe de aeroporto", "quote-0993", "waiting", "high", "João Mendes", "Operação", 2],
    ["27", "Definir protocolo de embarque noturno", "quote-0992", "todo", "high", "Rafael Lima", "Qualidade", 8],
    ["28", "Checar adicional de madrugada", "quote-0992", "todo", "medium", "Marina Alves", "Financeiro", 9],
    ["29", "Arquivar aceite da diretoria", "quote-0991", "done", "low", "Camila Torres", "Comercial", -6],
    ["30", "Atualizar quadro de disponibilidade", null, "doing", "medium", "Rafael Lima", "Operação", 0],
    ["31", "Conferir certificados dos veículos", null, "waiting", "high", "João Mendes", "Qualidade", 1],
    ["32", "Revisar tabela de parceiros", null, "todo", "medium", "Marina Alves", "Financeiro", 4],
    ["33", "Distribuir escala do fim de semana", null, "done", "low", "Camila Torres", "Operação", -1],
    ["34", "Registrar retorno do cliente", null, "todo", "medium", "Não atribuído", "Comercial", 3],
    ["35", "Tratar divergência de quilometragem", null, "waiting", "high", "Marina Alves", "Qualidade", -2],
    ["36", "Solicitar segunda via do comprovante", null, "todo", "low", "Camila Torres", "Financeiro", 5],
    ["37", "Validar plano de contingência", null, "doing", "high", ["João Mendes", "Rafael Lima"], "Qualidade", 2],
    ["38", "Confirmar contato de plantão", null, "done", "medium", "Rafael Lima", "Operação", -3],
    ["39", "Reabrir negociação de horário", "quote-1007", "todo", "high", "Marina Alves", "Comercial", 2],
  ];
  recurringTasks.forEach(([id, title, quoteId, status, priority, assignee, team, dueOffset]) => {
    const quote = quotes.find((item) => item.id === quoteId);
    tasks.push(task(`task-${id}`, title, quoteId, quote?.code || "OPS", quote?.title || "Rotina operacional interna", status, priority, assignee, team, dateFromToday(dueOffset), `Executar ${title.toLocaleLowerCase("pt-BR")} e registrar evidência no histórico.`));
  });
  tasks.push(
    task("task-40", "Revisar pendências prioritárias do dia", null, "OPS-040", "Rotina operacional interna", "doing", "high", "Renan Martins", "Comercial", dateFromToday(0), "Consolidar pendências críticas, cobrar responsáveis e registrar próximos passos."),
    task("task-41", "Aprovar mensagem para cliente estratégico", "quote-1004", "COT-1004", "Roadshow executivo · São Paulo e Campinas", "todo", "high", "Renan Martins", "Comercial", dateFromToday(1), "Validar texto final antes do envio ao cliente e registrar a decisão.", "task-40"),
    task("task-42", "Acompanhar retorno do fornecedor", "quote-1007", "COT-1007", "Van executiva · Evento corporativo", "waiting", "medium", ["Renan Martins", "Rafael Lima"], "Operação", dateFromToday(1), "Cobrar disponibilidade da segunda van e atualizar a equipe."),
    task("task-43", "Revisar comentário da ocorrência QAL-205", null, "QAL-205", "Divergência de quilometragem faturada", "todo", "medium", "Renan Martins", "Qualidade", dateFromToday(2), "Ler evidências, validar a tratativa e encaminhar decisão.", null, { sourceType: "quality", sourceId: "quality-error-205", sourceLabel: "Erro operacional", sourceCode: "QAL-205" }),
    task("task-44", "Confirmar fechamento semanal", null, "OPS-044", "Rotina operacional interna", "done", "low", "Renan Martins", "Financeiro", dateFromToday(-1), "Conferir se todas as tarefas críticas têm evidência e responsável."),
  );
  const seedNow = new Date().toISOString();
  const enrichTask = (id, comments = [], attachments = [], history = []) => {
    const item = tasks.find((taskItem) => taskItem.id === id);
    if (!item) return;
    item.comments = comments.map((text, index) => ({ id: `${id}-comment-${index + 1}`, text, createdAt: seedNow, author: index ? "Rafael Lima" : "Camila Torres" }));
    item.attachments = attachments.map((attachment, index) => {
      const input = typeof attachment === "string" ? { name: attachment } : attachment;
      return { id: `${id}-file-${index + 1}`, name: input.name, mimeType: input.mimeType || "", size: input.size || 0, previewUrl: input.previewUrl || "", createdAt: seedNow };
    });
    item.history = [...item.history, ...history.map((text, index) => ({ id: `${id}-history-${index + 1}`, text, createdAt: seedNow, author: index ? "Sistema" : "Marina Alves" }))];
  };
  enrichTask("task-1", ["Cliente pediu confirmação da janela de embarque antes do envio.", "Margem revisada; falta apenas validar a política de espera."], ["briefing-grupo-horizonte.pdf", "composicao-cotacao-1008.xlsx"], ["Responsável alterado para Marina Alves.", "Cotação vinculada ao Planner."]);
  enrichTask("task-7", ["Fornecedor informou indisponibilidade do veículo originalmente reservado."], ["registro-contato-fornecedor.msg", { name: "foto-veiculo-executivo.svg", mimeType: "image/svg+xml", size: 184320, previewUrl: MOCK_IMAGE_PREVIEWS.vehicle }, { name: "comprovante-contato.svg", mimeType: "image/svg+xml", size: 97280, previewUrl: MOCK_IMAGE_PREVIEWS.document }], ["Ocorrência QAL-204 convertida em tarefa.", "Tarefa marcada como aguardando."]);
  enrichTask("task-22", ["Escala inicial aprovada pela coordenação."], ["escala-convencao-v1.xlsx"], ["Tarefa iniciada pela operação."]);
  enrichTask("task-35", [], ["relatorio-quilometragem.pdf"], ["Prazo ultrapassado; necessário registrar tratativa."]);
  enrichTask("task-40", ["Vou consolidar este quadro antes da reunião das 16h.", "Rafael, preciso do retorno do parceiro até o fim do dia."], ["pendencias-operacionais-2026-08-17.xlsx"], ["Tarefa atribuída ao usuário do cenário local."]);
  enrichTask("task-41", ["Mensagem revisada pelo Comercial; aguardando aprovação final."], [], ["Criada como subtarefa da revisão diária."]);
  enrichTask("task-43", ["Evidência disponível no relatório de quilometragem."], ["relatorio-quilometragem-qal-205.pdf"], ["Vinculada à ocorrência QAL-205."]);
  const mockAttachmentVariants = [
    { name: "evidencia-operacional.svg", mimeType: "image/svg+xml", size: 121856, previewUrl: MOCK_IMAGE_PREVIEWS.vehicle },
    { name: "comprovante-servico.svg", mimeType: "image/svg+xml", size: 106496, previewUrl: MOCK_IMAGE_PREVIEWS.document },
  ];
  const attachmentTargetCount = Math.ceil(tasks.length / 2);
  const tasksWithAttachments = tasks.filter((item) => item.attachments.length).length;
  tasks.filter((item) => !item.attachments.length).slice(0, Math.max(0, attachmentTargetCount - tasksWithAttachments)).forEach((item, index) => {
    item.attachments.push({ id: `${item.id}-file-mock`, ...mockAttachmentVariants[index % mockAttachmentVariants.length], createdAt: seedNow });
  });
  const addChecklist = (id, items) => {
    const item = tasks.find((taskItem) => taskItem.id === id);
    if (item) item.checklist = items.map((title, index) => ({ id: `${id}-check-${index + 1}`, title, done: index === items.length - 1 }));
  };
  addChecklist("task-1", ["Revisar tarifa base", "Confirmar janela de embarque", "Validar margem", "Enviar proposta"]);
  addChecklist("task-8", ["Criar ordem de serviço", "Conferir quatro janelas", "Validar pontos de apoio"]);
  addChecklist("task-40", ["Revisar atrasadas", "Cobrar bloqueios", "Atualizar próximos passos"]);
  addChecklist("task-42", ["Enviar cobrança ao parceiro", "Registrar retorno", "Atualizar status da tarefa"]);
  const employees = [
    { id: "employee-marina", name: "Marina Alves", userId: "user-marina", externalNotificationsAvailable: true },
    { id: "employee-rafael", name: "Rafael Lima", userId: "user-rafael" },
    { id: "employee-camila", name: "Camila Torres", userId: "user-camila" },
    { id: "employee-joao", name: "João Mendes", userId: "user-joao" },
    { id: "employee-luiza", name: "Luiza Prado", userId: "", externalNotificationsAvailable: false },
    { id: "employee-gustavo", name: "Gustavo Neri", userId: "user-gustavo" },
    { id: "employee-renan", name: "Renan Martins", userId: "user-renan", externalNotificationsAvailable: true, isMockCurrentUser: true },
  ];
  const quality = [
    { id: "quality-error-204", type: "error", code: "QAL-204", title: "Atraso na confirmação do fornecedor", description: "Fornecedor respondeu após a janela combinada para o embarque.", status: "Em tratamento", dueDate: dateFromToday(1), assigneeName: "Rafael Lima" },
    { id: "quality-error-205", type: "error", code: "QAL-205", title: "Divergência de quilometragem faturada", description: "Quilometragem informada não corresponde ao roteiro aprovado.", status: "Aberto", dueDate: dateFromToday(-2), assigneeName: "Marina Alves" },
    { id: "quality-error-206", type: "error", code: "QAL-206", title: "Veículo sem comprovante de higienização", description: "Evidência não anexada antes do início da operação.", status: "Em análise", dueDate: dateFromToday(3), assigneeName: "João Mendes" },
    { id: "quality-error-207", type: "error", code: "QAL-207", title: "Passageiro aguardou no terminal incorreto", description: "Ponto de encontro não foi confirmado no briefing final.", status: "Aberto", dueDate: dateFromToday(4), assigneeName: "Camila Torres" },
    { id: "quality-error-208", type: "error", code: "QAL-208", title: "Nota fiscal enviada sem pedido", description: "Documento fiscal precisa ser associado à cotação correta.", status: "Concluído", dueDate: dateFromToday(-4), assigneeName: "Marina Alves" },
    { id: "quality-action-301", type: "action", code: "ACT-301", title: "Padronizar checklist de aeroporto", description: "Criar checklist único para GRU, CGH e VCP.", status: "Em andamento", dueDate: dateFromToday(5), assigneeName: "João Mendes" },
    { id: "quality-action-302", type: "action", code: "ACT-302", title: "Atualizar roteiro de contingência", description: "Documentar alternativas para interdições e atrasos.", status: "Aberto", dueDate: dateFromToday(6), assigneeName: "Rafael Lima" },
    { id: "quality-action-303", type: "action", code: "ACT-303", title: "Treinar confirmação de passageiros", description: "Reforçar confirmação D-1 e D-0 com a equipe comercial.", status: "Planejado", dueDate: dateFromToday(8), assigneeName: "Camila Torres" },
  ];
  employees.forEach((employee) => { employee.externalNotificationsAvailable ??= Boolean(employee.userId); });
  tasks.forEach((item) => { item.creatorUserId ||= "user-renan"; item.creatorEmployeeId ||= "employee-renan"; item.assigneeIds ||= employees.filter((employee) => item.assigneeNames.includes(employee.name)).map((employee) => employee.id); });
  const notifications = [
    { id: "notification-1", taskId: "task-42", recipientEmployeeId: "employee-renan", type: "mention", title: "Rafael mencionou você", message: "Preciso do retorno do parceiro até o fim do dia.", occurredAt: new Date().toISOString(), readAt: "" },
    { id: "notification-2", taskId: "task-40", recipientEmployeeId: "employee-renan", type: "due_today", title: "Tarefa vence hoje", message: "Revisar pendências prioritárias do dia", occurredAt: new Date(Date.now() - 3600000).toISOString(), readAt: "" },
  ];
  return { quotes, tasks, employees, quality, notifications, lastUpdated: new Date().toISOString() };
}

function task(id, title, quoteId, quoteCode, quoteTitle, status, priority, assigneeName, teamName, dueDate, description, parentTaskId = null, context = {}) {
  const assigneeNames = normalizeAssigneeNames(assigneeName);
  return {
    id, title, parentTaskId, quoteId, quoteCode, quoteTitle, status, priority, assigneeNames, assigneeName: assigneeNames.join(", "), teamName, dueDate,
    description, checklist: context.checklist || [], labels: [quoteCode], sourceType: quoteId ? "quote" : "manual", sourceId: quoteId, sourceLabel: quoteId ? "Pedido de cotação" : "Tarefa manual", sourceCode: quoteCode, ...context, comments: context.comments || [], attachments: context.attachments || [],
    history: context.history || [{ id: uid("history"), text: "Tarefa criada no cenário de demonstração.", createdAt: new Date().toISOString(), author: "Sistema" }],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : seedState();
  } catch {
    return seedState();
  }
}

export function saveState(state) {
  const next = { ...state, lastUpdated: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function createTask(state, input) {
  if (input.quoteId && !input.parentTaskId) {
    const activeMain = state.tasks.find((taskItem) => taskItem.quoteId === input.quoteId && !taskItem.parentTaskId && !["done", "cancelled"].includes(taskItem.status));
    if (activeMain) throw new Error("Esta cotação já possui um acompanhamento principal ativo.");
  }
  const sourceType = input.sourceType || (input.quoteId ? "quote" : "manual");
  const assigneeNames = normalizeAssigneeNames(input.assigneeNames || input.assigneeName);
  const assigneeIds = input.assigneeIds || employeeIdsByNames(state.employees, assigneeNames);
  const nextTask = {
    id: uid("task"), parentTaskId: input.parentTaskId || null, quoteId: input.quoteId || null,
    quoteCode: input.quoteCode || "", quoteTitle: input.quoteTitle || "Sem vínculo", title: input.title.trim(),
    status: input.status || STATUSES[0].id, priority: input.priority || "medium", assigneeNames, assigneeName: assigneeNames.join(", "), assigneeIds,
    creatorEmployeeId: input.actorEmployeeId || "", creatorUserId: input.actorUserId || "",
    teamName: input.teamName || "Operação", dueDate: input.dueDate || "", description: input.description || "",
    checklist: input.checklist || [], labels: input.quoteCode ? [input.quoteCode] : [], sourceType, sourceId: input.sourceId || input.quoteId || null, sourceLabel: input.sourceLabel || (sourceType === "quality" ? "Ação de qualidade" : sourceType === "quote" ? "Pedido de cotação" : "Tarefa manual"), sourceCode: input.sourceCode || input.quoteCode || "", comments: [], attachments: [],
    history: [{ id: uid("history"), text: "Tarefa criada no mock.", createdAt: new Date().toISOString(), author: "Você" }],
  };
  const notifications = [...(state.notifications || [])];
  notificationRecipients({ type: "assignment", assigneeIds, actorEmployeeId: input.actorEmployeeId }).forEach((recipientEmployeeId) => {
    notifications.unshift({ id: uid("notification"), taskId: nextTask.id, recipientEmployeeId, type: "assignment", title: "Nova tarefa atribuída", message: nextTask.title, occurredAt: new Date().toISOString(), readAt: "", dedupeKey: notificationDedupeKey({ recipientId: recipientEmployeeId, taskId: nextTask.id, type: "assignment", eventId: nextTask.id }) });
  });
  return saveState({ ...state, tasks: [...state.tasks, nextTask], notifications });
}

export function updateTask(state, id, patch) {
  const existing = state.tasks.find((taskItem) => taskItem.id === id);
  const tasks = state.tasks.map((taskItem) => {
    if (taskItem.id !== id) return taskItem;
    const nextStatus = patch.status ?? taskItem.status;
    const statusChanged = patch.status !== undefined && patch.status !== taskItem.status;
    const history = [...(taskItem.history || [])];
    if (statusChanged) history.push({ id: uid("history"), text: nextStatus === "done" ? "Tarefa concluída." : `Status alterado para ${STATUSES.find((item) => item.id === nextStatus)?.label || nextStatus}.`, createdAt: new Date().toISOString(), author: "Você" });
    return { ...taskItem, ...patch, status: nextStatus, history };
  });
  if (!existing) return saveState({ ...state, tasks });
  const next = tasks.find((taskItem) => taskItem.id === id);
  const changes = [
    patch.status !== undefined && patch.status !== existing.status ? "status" : "",
    patch.dueDate !== undefined && patch.dueDate !== existing.dueDate ? "deadline" : "",
    patch.assigneeNames !== undefined && JSON.stringify(normalizeAssigneeNames(patch.assigneeNames)) !== JSON.stringify(normalizeAssigneeNames(existing.assigneeNames)) ? "assignees" : "",
  ].filter(Boolean);
  const notifications = [...(state.notifications || [])];
  changes.forEach((type) => notificationRecipients({ type, creatorEmployeeId: existing.creatorEmployeeId, assigneeIds: next.assigneeIds || employeeIdsByNames(state.employees, next.assigneeNames), previousAssigneeIds: existing.assigneeIds || employeeIdsByNames(state.employees, existing.assigneeNames), nextStatus: next.status, actorEmployeeId: patch.actorEmployeeId }).forEach((recipientEmployeeId) => {
    const eventId = uid("event");
    notifications.unshift({ id: uid("notification"), taskId: id, recipientEmployeeId, type, title: type === "deadline" ? "Prazo alterado" : type === "status" ? "Status alterado" : "Responsáveis alterados", message: next.title, occurredAt: new Date().toISOString(), readAt: "", dedupeKey: notificationDedupeKey({ recipientId: recipientEmployeeId, taskId: id, type, eventId }) });
  }));
  (patch.mentionedEmployeeIds || []).filter((employeeId) => employeeId !== patch.actorEmployeeId).forEach((recipientEmployeeId) => {
    const eventId = uid("event");
    notifications.unshift({ id: uid("notification"), taskId: id, recipientEmployeeId, type: "mention", title: "Você foi mencionado", message: next.title, occurredAt: new Date().toISOString(), readAt: "", dedupeKey: notificationDedupeKey({ recipientId: recipientEmployeeId, taskId: id, type: "mention", eventId }) });
  });
  return saveState({ ...state, tasks, notifications });
}

function employeeIdsByNames(employees = [], names = []) {
  const wanted = new Set(normalizeAssigneeNames(names));
  return employees.filter((employee) => wanted.has(employee.name)).map((employee) => employee.id);
}

export function deleteTask(state, id) {
  return saveState({ ...state, tasks: state.tasks.filter((taskItem) => taskItem.id !== id) });
}

export function addComment(state, id, text, context = {}) {
  const comment = { id: uid("comment"), text: text.trim(), createdAt: new Date().toISOString(), author: "Você" };
  const notifications = [...(state.notifications || [])];
  (context.mentionedEmployeeIds || []).filter((employeeId) => employeeId !== context.actorEmployeeId).forEach((recipientEmployeeId) => notifications.unshift({ id: uid("notification"), taskId: id, recipientEmployeeId, type: "mention", title: "Você foi mencionado", message: text.trim(), occurredAt: new Date().toISOString(), readAt: "", dedupeKey: notificationDedupeKey({ recipientId: recipientEmployeeId, taskId: id, type: "mention", eventId: comment.id }) }));
  return saveState({ ...state, notifications, tasks: state.tasks.map((taskItem) => taskItem.id === id ? { ...taskItem, comments: [...taskItem.comments, comment] } : taskItem) });
}

export function addAttachment(state, id, name) {
  const input = typeof name === "object" ? name : { name };
  const attachment = { id: uid("file"), name: input.name || "Arquivo", mimeType: input.mimeType || "", size: input.size || 0, previewUrl: input.previewUrl || "", createdAt: new Date().toISOString() };
  return saveState({ ...state, tasks: state.tasks.map((taskItem) => taskItem.id === id ? { ...taskItem, attachments: [...taskItem.attachments, attachment] } : taskItem) });
}

export function deleteAttachment(state, taskId, attachmentId) {
  return saveState({ ...state, tasks: state.tasks.map((taskItem) => taskItem.id === taskId ? { ...taskItem, attachments: taskItem.attachments.filter((attachment) => attachment.id !== attachmentId) } : taskItem) });
}

export function markNotificationRead(state, notificationId, readAt = new Date().toISOString()) {
  return saveState({ ...state, notifications: (state.notifications || []).map((item) => item.id === notificationId ? { ...item, readAt } : item) });
}

export function markAllNotificationsRead(state, recipientEmployeeId, readAt = new Date().toISOString()) {
  return saveState({ ...state, notifications: (state.notifications || []).map((item) => item.recipientEmployeeId === recipientEmployeeId ? { ...item, readAt: item.readAt || readAt } : item) });
}

export function ensureQuoteTask(state, quote) {
  const existing = state.tasks.find((taskItem) => taskItem.quoteId === quote.id && !taskItem.parentTaskId);
  if (existing) return state;
  return createTask(state, { title: `Acompanhar ${quote.code}`, quoteId: quote.id, quoteCode: quote.code, quoteTitle: quote.title, dueDate: quote.deadline, priority: "medium", assigneeName: "Não atribuído", teamName: "Comercial", description: `Acompanhar a cotação ${quote.code} até a resposta ao cliente.` });
}

export function resetState() {
  const next = seedState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
