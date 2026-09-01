# Plano de uso: integração Planner ↔ Cotação (`cr40f_TelaPedirCotacao`)

> Este plano é sobre **experiência e jornada do usuário**, não sobre implementação de código. Cada fase descreve o que a pessoa vive, o que ela vê e o que ela consegue fazer — as tarefas de código para viabilizar cada fase ficam para um plano de execução separado.
>
> **Este documento substitui uma versão anterior** que partiu de uma premissa errada (cotação e tarefa como dois registros ligados por um vínculo opcional). A premissa correta, estabelecida pelo usuário: **uma cotação É uma tarefa — uma única unidade de trabalho, vista por duas telas diferentes.**

## Premissa central (não é mais uma opção em aberto)

Cotação e tarefa não são dois registros relacionados que precisam ser "sincronizados de vez em quando". São **uma coisa só**:

- Toda cotação nasce **já sendo** uma tarefa operacional — nunca existe uma sem a outra.
- Qualquer campo relevante de qualquer um dos dois lados é **visível e editável a partir de qualquer uma das duas telas** (unificação total, não só um núcleo comum de status/prazo).
- A consistência entre as duas telas é **tudo-ou-nada, nos dois sentidos**: se uma mudança em um lado não conseguir refletir no outro, a operação inteira falha — não existe estado intermediário onde só um dos lados foi atualizado.

Isso vale tanto para a criação quanto para toda atualização subsequente (status, prazo, valor, responsável, prioridade, etc.) — não só para o nascimento do registro.

## Quem está envolvido (modelo de pessoas)

Não há um "dono" fixo em nenhuma ponta:
- **Várias pessoas podem pedir** uma cotação.
- **Várias pessoas (as mesmas ou outras) podem atualizar e concluir** a mesma cotação/tarefa.
- O Planner já suporta múltiplos responsáveis simultâneos por tarefa (tabela `cr40f_plannertarearesponsavel`, confirmado no código — não é uma lacuna).
- **Quem pediu**, hoje, só é rastreável pelos campos técnicos padrão do Dataverse (`createdby`/`ownerid`) — não existe um campo de negócio dedicado de "solicitante" na tabela `cr40f_pedidodecotacao` (confirmado via metadata real, ver Anexo). Decisão do usuário: usar `createdby`/`ownerid` como estão, sem propor campo novo.

## O que já existe hoje (não precisa ser refeito)

Evidência coletada em [README.md](README.md), [src/App.jsx](src/App.jsx), [src/dataverse.js](src/dataverse.js), [src/QuotesView.jsx](src/QuotesView.jsx):

- Deep-link `?source=quote&sourceId=<id>` abre o Planner e cria/abre a tarefa vinculada — mas isso é uma criação **assíncrona e dependente de alguém clicar**, o que contradiz a premissa central. Precisa deixar de ser o mecanismo primário (ver Fase 1).
- Navegação Planner → Cotação existe a partir do centro de notificações (`quote_followup` → abre `cr40f_TelaPedirCotacao.html?view=recent&recordId=...`), mas não a partir da própria tela de Cotações do Planner.
- A tela de Cotações no Planner é hoje **somente consulta** (busca, filtro, drawer de detalhe) — não permite editar nenhum campo da cotação a partir do Planner. Isso contradiz a unificação total decidida.
- Já existe automação Power Automate robusta e testada para notificações e cobrança de prazo ([power-platform/notifications/README.md](power-platform/notifications/README.md)): dedup por chave, múltiplos canais (Teams/e-mail), tratamento de "sem identidade", retry por destinatário. Isso é reaproveitável para a Fase 4.
- Confirmado no código (`src/dataverse.js`, uso de `cr40f_responsavel` restrito às tabelas de Qualidade): o campo legado `cr40f_responsavel` (singular, na tarefa) não é usado pelo Planner — só a tabela relacional de múltiplos responsáveis importa.

## Decisão em aberto que este plano NÃO fecha

O usuário identificou, mas ainda não decidiu, se a unificação total leva ao limite de **virar uma única tela/experiência** (ex: abrir a tarefa no Planner já mostra os campos da cotação embutidos, sem trocar de sistema) ou se **continuam sendo duas telas separadas**, cada uma com seu propósito e público, apenas com o dado tratado como uma unidade por baixo. As fases abaixo são desenhadas para funcionar em qualquer um dos dois cenários — mas a Fase 3 (navegação) muda de forma dependendo dessa escolha, e isso é sinalizado explicitamente nela.

---

## Ordem das fases

1. Nascimento automático e obrigatório (cotação = tarefa desde o primeiro salvamento)
2. Unificação de campos e visibilidade (qualquer campo, visível/editável dos dois lados)
3. Navegação entre as telas (formato depende da decisão em aberto acima)
4. Notificações cruzadas de mudança

---

## Fase 1 — Nascimento automático e obrigatório

**Problema de uso:** hoje a tarefa só é criada se alguém abrir o Planner via deep-link. Isso é incompatível com "cotação é tarefa" — a tarefa precisa nascer no mesmo instante em que a cotação é salva, sem depender de nenhuma ação humana adicional.

**Jornada alvo:**
1. Uma pessoa qualquer (quem pede a cotação, na tela de cotação) preenche os dados e salva.
2. Nesse exato momento — sem ela precisar saber ou fazer nada a mais — a tarefa correspondente já existe no Planner.
3. Ela não vê nenhuma confirmação especial disso na tela de cotação (decisão do usuário: a criação é invisível para quem salva; só quem for ao Planner depois vê a tarefa lá).
4. Se, por qualquer motivo, a tarefa não puder ser criada, **a cotação inteira não é salva**. A pessoa vê uma mensagem de erro genérica de "não foi possível salvar, tente novamente" (decisão do usuário: sem jargão técnico de Planner/Dataverse) e pode tentar de novo.

**O que isso significa na prática de uso:**
- Nunca existe, mesmo que por um segundo, uma cotação sem tarefa — exceto no instante de uma falha, e nesse caso a cotação em si também não existe (não foi salva).
- "Cotação sem tarefa" deixa de ser um estado que a interface precisa tratar como normal — se aparecer, é sinal de dado inconsistente/corrompido, não de um fluxo pendente.
- Qualquer tela (cotação ou Planner) que hoje mostra "sem tarefa" como opção válida deixa de fazer sentido nesse modelo e deve ser removida ou reinterpretada como estado de erro.

**Critério de aceite (uso):**
- Ninguém consegue, em uso normal, produzir uma cotação sem tarefa correspondente.
- Uma falha na criação da tarefa impede visivelmente o salvamento da cotação — a pessoa recebe um retorno claro de que precisa tentar de novo, não uma falsa sensação de sucesso.

---

## Fase 2 — Unificação de campos e visibilidade

**Problema de uso:** hoje a tela de Cotações do Planner é somente leitura e mostra só um subconjunto de campos (código, cliente, status, prazo, valor). A tela de cotação, do outro lado, não expõe nada do mundo operacional (prioridade, board, múltiplos responsáveis, histórico). Cada tela só conhece metade da unidade de trabalho.

**Jornada alvo:**
1. A partir do Planner, ao abrir uma tarefa originada de cotação, a pessoa vê e pode editar também os campos hoje exclusivos da cotação — cliente/empresa, tipo de serviço, tipo de veículo, datas do serviço, contato do cliente, valor cotado, condição comercial, etc. — não só o resumo atual (código/cliente/status/prazo/valor).
2. A partir da tela de cotação, a pessoa vê e pode editar também os campos hoje exclusivos da tarefa — prioridade, status operacional (board), responsável(is) atribuído(s), histórico/eventos.
3. Qualquer pessoa, em qualquer uma das duas telas, enxerga **quem pediu** (via `createdby`/`ownerid`, decisão do usuário) e **quem está atuando agora** (responsáveis atuais da tarefa) sem precisar abrir a outra tela para descobrir.
4. Uma mudança feita em um campo, a partir de qualquer lado, aparece refletida no outro imediatamente — porque, na prática, é o mesmo dado.

**Casos de borda de uso a cobrir:**
- Duas pessoas editando campos diferentes da mesma cotação/tarefa ao mesmo tempo, uma pelo Planner e outra pela tela de cotação — nenhuma deve perder silenciosamente a edição da outra.
- Se uma edição em um lado não conseguir ser refletida no outro (ex: por indisponibilidade), a mesma trava tudo-ou-nada da Fase 1 se aplica: a edição não é aceita em nenhum dos dois lados, e a pessoa recebe um erro claro pedindo para tentar de novo.

**Critério de aceite (uso):**
- Não existe mais nenhum campo que só possa ser visto ou editado em uma das duas telas.
- Uma pessoa nova, que nunca viu aquele registro, entende em segundos — a partir de qualquer uma das telas — quem pediu, quem está atuando, e o estado atual completo (comercial e operacional).

---

## Fase 3 — Navegação entre as telas

**Depende da decisão em aberto:** esta fase muda de forma conforme o usuário decidir, no futuro, entre "duas telas sincronizadas" ou "uma experiência só". Descrevemos os dois cenários para que o plano continue válido enquanto essa decisão amadurece.

**Cenário A — continuam duas telas separadas:**
1. A partir do drawer de detalhe de uma cotação no Planner, existe uma ação "Abrir na tela de Cotação" que leva direto para `cr40f_TelaPedirCotacao` naquele registro específico (mesmo padrão `view=recent&recordId=...` já usado hoje a partir de notificações) — não para o formulário genérico do Dataverse (`openQuote` atual).
2. A navegação funciona nos dois sentidos, a qualquer momento, não só a partir de notificações.

**Cenário B — tendendo a uma experiência só:**
1. Abrir a tarefa no Planner já mostra os campos da cotação embutidos na mesma tela/drawer (consequência natural da Fase 2, se levada ao limite) — a "navegação" deixa de ser necessária porque não há mais duas telas para ir e voltar, só uma.
2. `cr40f_TelaPedirCotacao` pode continuar existindo como uma segunda porta de entrada para o mesmo dado (para quem já tem esse hábito), mas deixa de ser a única fonte de campos comerciais.

**O que este plano recomenda:** avançar a Fase 2 (unificação de campos) primeiro, já que ela é necessária em qualquer um dos dois cenários — e só then decidir entre A e B, quando ficar mais claro, na prática, se manter duas telas ainda faz sentido ou se a sobreposição de campos tornou isso redundante.

**Critério de aceite (uso), válido nos dois cenários:**
- Ninguém precisa passar pelo formulário genérico do Dataverse para ver ou agir sobre uma cotação a partir do Planner.
- A pessoa nunca perde contexto (o que estava filtrando, olhando, editando) ao transitar entre as visões — seja por navegação (cenário A) seja porque já está tudo na mesma tela (cenário B).

---

## Fase 4 — Notificações cruzadas de mudança

**Problema de uso:** com múltiplas pessoas podendo mexer nos dois lados (e, a partir da Fase 2, os dois lados sendo literalmente o mesmo dado), o risco de uso é alguém continuar agindo sobre uma cotação/tarefa que outra pessoa já resolveu por outro canal, sem saber.

**Jornada alvo:**
1. Quando qualquer campo relevante muda (status, prazo, conclusão) — venha a mudança da tela de cotação ou do Planner — todas as pessoas com responsabilidade ativa naquele registro são notificadas, reaproveitando a infraestrutura de notificações já existente e testada ([power-platform/notifications/README.md](power-platform/notifications/README.md)): dedup por chave, múltiplos canais, tratamento de "sem identidade".
2. Prazos perto de vencer geram aviso proativo (já existe o flow "Cobrança diária" fazendo isso para tarefas — precisa cobrir também o prazo de resposta da cotação, que hoje é o mesmo campo por definição da Fase 1/2).
3. A notificação leva direto para o registro (tarefa ou cotação, conforme o cenário de navegação vigente na Fase 3).

**Critério de aceite (uso):**
- Ninguém descobre "por acaso, dias depois" que a cotação/tarefa que estava tocando já foi respondida ou cancelada por outra pessoa.
- Prazos de resposta perto de vencer geram aviso proativo, não só destaque visual passivo na lista.

---

## Fora de escopo deste plano

- Layout, campos ou regras de negócio específicas de `cr40f_TelaPedirCotacao` além do que é necessário para a unificação da Fase 2.
- Nome exato de endpoints, triggers, ou tecnologia usada para garantir a trava tudo-ou-nada (Plugin síncrono, Custom API, transação — isso é decisão de execução técnica, não de uso).
- Criar um campo de negócio dedicado para "solicitante" na cotação — decisão do usuário foi usar os campos técnicos padrão como estão.
- Regras de permissão de quem pode editar o quê — mencionado como constatação (é plural, sem dono fixo), não especificado aqui.

## Perguntas ainda em aberto

1. **Uma tela ou duas no limite?** (Fase 3, cenário A vs. B) — usuário sinalizou que ainda não sabe; revisitar depois que a Fase 2 estiver rodando na prática.
2. A trava tudo-ou-nada bidirecional tem implicação técnica pesada (transação distribuída entre dois sistemas/tabelas). Vale confirmar, no plano de execução, se isso é viável de forma síncrona real ou se vai precisar de um desenho de compensação (ex: saga) que **pareça** tudo-ou-nada para quem usa, mesmo sem ser uma transação atômica de banco.
3. Com "quem pediu" limitado a `createdby`/`ownerid`, o que acontece quando a cotação é criada por uma automação/integração externa (ex: formulário público, WhatsApp) e não por um usuário logado? Vale checar se `createdby` sempre é preenchido de forma significativa nesses canais (`cr40f_canalentrada`).

---

## Anexo — metadata real confirmado (Dataverse, ambiente DEV)

Levantado via export de metadata em 2026-08-25 (`EntityDefinitions` da org `org23b93544`), não por suposição:

**`cr40f_pedidodecotacao` (Pedido de Cotação)** — campos de negócio relevantes: `cr40f_numerodacotacao`, `cr40f_titulo` (nome primário, rotulado "ID"), `cr40f_cliente` (lookup) e `cr40f_clienteempresa` (texto), `cr40f_contatocliente`, `cr40f_emailcliente`, `cr40f_telefonewhatsapp`, `cr40f_tiposervico`, `cr40f_tipoveiculo`, `cr40f_canalentrada`, `cr40f_destino`, `cr40f_quantidadepassageiros`, `cr40f_datahoraservico`, `cr40f_datahoraretorno`, `cr40f_retorno`, `cr40f_condicaocomercial`, `cr40f_observacoespedido`, `cr40f_statuscotacao`, `cr40f_prazoresponder`, `cr40f_valorcotado`, `cr40f_respostaenviadacliente`, `cr40f_datahorafinalizacao`. Campos de integração: `cr40f_plannertaskid`, `cr40f_linktarefaplanner`, `cr40f_linkmensagemteams`, `cr40f_origemultimasincronizacao`, `cr40f_ultimasincronizacao`, `cr40f_ultimolembretependencia`.
**Não existe** nenhum campo custom de solicitante/responsável de negócio — só os padrão `createdby`, `createdonbehalfby`, `ownerid` (aponta para `systemuser` ou `team`), `modifiedby`.

**`cr40f_plannertarefa` (Tarefa Planner)** — campos de negócio: `cr40f_titulo`, `cr40f_name`, `cr40f_descricao`, `cr40f_status`, `cr40f_prioridade`, `cr40f_prazo`, `cr40f_dataconclusao`, `cr40f_motivobloqueio`, `cr40f_equipe` (lookup para `team`), `cr40f_origem`, `cr40f_codigoorigem`, `cr40f_pedidocotacao` (lookup para `cr40f_pedidodecotacao` — é o vínculo hoje), `cr40f_errooperacional`/`cr40f_acaooperacional` (vínculo com Qualidade). Campo legado confirmado sem uso real: `cr40f_responsavel` (lookup singular para `systemuser`) — o código do Planner nunca lê nem escreve nele; só usa a tabela relacional `cr40f_plannertarearesponsavel` (múltiplos, aponta para `cr40f_funcionarios`).
