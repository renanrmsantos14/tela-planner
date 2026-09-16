# Revisão da criação de cotação — mockups

Mockups gerados com o `image_gen` integrado para a etapa final de criação. Os dados exibidos são fictícios. A aplicação ainda usa a implementação em `src/quotes/QuoteCreateDrawer.jsx`.

## Rodada atual — minimalista

Após o feedback de que a primeira rodada estava carregada, os novos prompts reduziram a interface a tipografia, divisórias finas e uma ação principal. Sem grade de cartões, coleção de ícones, badges, sombras, barra de etapas horizontal ou avisos coloridos grandes.

| Arquivo | Direção |
| --- | --- |
| `minimal/01-lista-essencial.png` | Quatro linhas com os dados principais e edição por linha |
| `minimal/02-trajeto-em-foco.png` | Um único destaque para o trajeto; demais dados sob demanda |
| `minimal/03-secoes-recolhidas.png` | Três seções curtas que podem ser abertas para conferir detalhes |
| `minimal/04-mobile.png` | Trajeto e três linhas essenciais em uma coluna, com ação fixa |

**Direção sugerida para a próxima avaliação:** `minimal/02` no desktop e `minimal/04` no mobile. A `minimal/01` é alternativa se os dados precisarem aparecer sem abrir detalhes.

## Primeira rodada — arquivada para comparação

| Arquivo | Direção | Melhor uso |
| --- | --- | --- |
| `01-painel-executivo.png` | Trajeto e pedido em destaque, cliente e comercial em coluna lateral | Leitura rápida e hierarquia visual em desktop |
| `02-revisao-compacta.png` | Ficha de conferência com linhas de rótulo e valor | Maior densidade em um drawer estreito |
| `03-checklist-prontidao.png` | Seções conferidas e pendências opcionais separadas | Tornar o estado de prontidão explícito |
| `04-mobile.png` | Fluxo em coluna única com ação principal fixa | Referência para telas pequenas e toque |
| `05-pedido-expandido.png` | Estado do painel executivo após abrir o pedido completo | Conferir leitura de texto longo no contexto da revisão |
| `06-confirmar-sem-prazo.png` | Estado do painel executivo após confirmar sem prazo | Avaliar a decisão explícita antes da criação |

O usuário considerou esta rodada carregada. Seus seis arquivos permanecem para comparação de ideias e estados de interação, sem orientar a implementação visual.

## Contrato de UX para a implementação

- Tornar acessíveis título interno, cliente, solicitante, canal de contato, serviço, veículo, origem, destino, data e hora, prazo, prioridade, acompanhamento, valor, condições comerciais, pedido original e anexos conforme o rascunho. A visão inicial pode mostrar somente o essencial; os detalhes restantes precisam de uma ação clara para abrir. Não inventar valores para campos vazios.
- Destacar trajeto e horário; formatar data e prioridade para leitura em pt-BR. Texto longo deve quebrar dentro do contêiner, sem rolagem horizontal. O pedido original pode ter resumo expansível, mas deve permanecer acessível por inteiro.
- Cada grupo precisa de um comando **Editar** que volte à etapa correta sem perder dados. A revisão precisa manter a navegação por teclado, foco visível e mensagens de erro ligadas ao campo relevante.
- Separar erros obrigatórios de avisos opcionais sem introduzir grandes blocos visuais. O prazo ausente já possui confirmação específica no fluxo atual; qualquer mudança nessa confirmação deve manter a decisão explícita antes de criar.
- Manter o rodapé de ações visível durante a rolagem. Na confirmação, indicar carregamento, falha e resultado com texto compreensível. Explicar que o registro nasce no status **Nova**.
- Em mobile, usar uma coluna, alvos de toque confortáveis e ação principal visível, sem comprimir as quatro etapas lado a lado.

## Briefs da rodada minimalista

1. **Lista essencial:** quatro linhas com cliente, trajeto, serviço e comercial; dados opcionais em texto discreto; edição direta e rodapé fixo.
2. **Trajeto em foco:** apenas o trajeto recebe um contorno leve; cliente e prazo são fatos tipográficos; demais dados ficam em uma seção fechada.
3. **Seções recolhidas:** cliente, serviço e comercial aparecem como três resumos; abrir cada seção revela o conteúdo integral.
4. **Mobile:** uma coluna com trajeto, três linhas essenciais, detalhes fechados e ação principal fixa.

## Briefs da primeira rodada

1. **Painel executivo:** resumo do trajeto como elemento principal, pedido do cliente legível, cliente e comercial na lateral, edição por bloco, aviso opcional e rodapé fixo.
2. **Revisão compacta:** ficha em uma coluna, linhas de rótulo e valor, três seções editáveis, resumo do pedido expansível e rodapé fixo.
3. **Checklist de prontidão:** confirmação dos dados obrigatórios por seção e faixa separada para pendências opcionais confirmáveis.
4. **Mobile:** hierarquia em coluna única, progresso compacto, resumo do trajeto, seções editáveis e ação principal fixa.
5. **Pedido expandido:** manter o painel executivo e abrir a mensagem inteira no mesmo bloco, com quebra de linha e comando para recolher.
6. **Sem prazo:** manter o painel executivo ao fundo e abrir uma confirmação acessível com as escolhas **Definir prazo** e **Criar sem prazo**.
