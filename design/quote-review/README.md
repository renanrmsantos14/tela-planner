# Revisão da criação de cotação — mockups

Quatro direções visuais e dois estados de interação gerados com o `image_gen` integrado, tomando a captura da etapa atual como referência. Os dados exibidos são fictícios. Estes arquivos são propostas de interface; a aplicação ainda usa a implementação em `src/quotes/QuoteCreateDrawer.jsx`.

| Arquivo | Direção | Melhor uso |
| --- | --- | --- |
| `01-painel-executivo.png` | Trajeto e pedido em destaque, cliente e comercial em coluna lateral | Leitura rápida e hierarquia visual em desktop |
| `02-revisao-compacta.png` | Ficha de conferência com linhas de rótulo e valor | Maior densidade em um drawer estreito |
| `03-checklist-prontidao.png` | Seções conferidas e pendências opcionais separadas | Tornar o estado de prontidão explícito |
| `04-mobile.png` | Fluxo em coluna única com ação principal fixa | Referência para telas pequenas e toque |
| `05-pedido-expandido.png` | Estado do painel executivo após abrir o pedido completo | Conferir leitura de texto longo no contexto da revisão |
| `06-confirmar-sem-prazo.png` | Estado do painel executivo após confirmar sem prazo | Avaliar a decisão explícita antes da criação |

## Direção recomendada

Usar o painel executivo no desktop e a composição mobile em telas pequenas. Incorporar do checklist a distinção entre campos obrigatórios e opcionais. O valor não informado e o veículo a definir devem ser avisos claros e confirmáveis, não erros que impeçam a criação.

## Contrato de UX para a implementação

- Mostrar título interno, cliente, solicitante, canal de contato, serviço, veículo, origem, destino, data e hora, prazo, prioridade, acompanhamento, valor, condições comerciais, pedido original e anexos conforme os dados presentes no rascunho. Não inventar valores para campos vazios.
- Destacar trajeto e horário; formatar data e prioridade para leitura em pt-BR. Texto longo deve quebrar dentro do contêiner, sem rolagem horizontal. O pedido original pode ter resumo expansível, mas deve permanecer acessível por inteiro.
- Cada grupo precisa de um comando **Editar** que volte à etapa correta sem perder dados. A revisão precisa manter a navegação por teclado, foco visível e mensagens de erro ligadas ao campo relevante.
- Separar erros obrigatórios de avisos opcionais. O prazo ausente já possui confirmação específica no fluxo atual; qualquer mudança nessa confirmação deve manter a decisão explícita antes de criar.
- Manter o rodapé de ações visível durante a rolagem. Na confirmação, indicar carregamento, falha e resultado com texto compreensível. Explicar que o registro nasce no status **Nova**.
- Em mobile, usar uma coluna, alvos de toque confortáveis e ação principal visível, sem comprimir as quatro etapas lado a lado.

## Briefs usados na geração

1. **Painel executivo:** resumo do trajeto como elemento principal, pedido do cliente legível, cliente e comercial na lateral, edição por bloco, aviso opcional e rodapé fixo.
2. **Revisão compacta:** ficha em uma coluna, linhas de rótulo e valor, três seções editáveis, resumo do pedido expansível e rodapé fixo.
3. **Checklist de prontidão:** confirmação dos dados obrigatórios por seção e faixa separada para pendências opcionais confirmáveis.
4. **Mobile:** hierarquia em coluna única, progresso compacto, resumo do trajeto, seções editáveis e ação principal fixa.
5. **Pedido expandido:** manter o painel executivo e abrir a mensagem inteira no mesmo bloco, com quebra de linha e comando para recolher.
6. **Sem prazo:** manter o painel executivo ao fundo e abrir uma confirmação acessível com as escolhas **Definir prazo** e **Criar sem prazo**.
