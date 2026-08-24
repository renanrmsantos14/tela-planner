# UI Review — Área de anexos das tasks

## Resultado

A área de anexos saiu de uma lista pouco descoberta para um bloco de evidências com envio por clique/arraste, estados de sincronização, identificação por tipo, tamanho, estado vazio e preview de imagens em lightbox.

## Auditoria dos seis pilares

| Pilar | Nota | Evidência |
| --- | ---: | --- |
| Hierarquia visual | 4/4 | Dropzone é o primeiro CTA; arquivos ficam em cards escaneáveis; contagem e limite aparecem no cabeçalho. |
| Clareza de conteúdo | 4/4 | Nome, tipo, tamanho e estado ficam separados; estado vazio explica o que anexar. |
| Layout e responsividade | 4/4 | Grid da dropzone quebra no mobile; nomes longos usam ellipsis; preview reserva altura para reduzir layout shift. |
| Interação e feedback | 4/4 | Clique, arraste/solte, estado “Enviando”, estado “Salvo”, feedback de preview e fechamento por backdrop. |
| Acessibilidade | 3/4 | Input nativo continua acionável por teclado via label; preview e fechar têm nomes acessíveis. Falta validação em leitor de tela real. |
| Consistência e acabamento | 3/4 | Ícones Lucide, tokens e motion curto seguem o Planner; QA visual real ficou pendente porque o daemon Playwright retornou `EPERM`. |

## Antes / depois

| Before | After | Why |
| --- | --- | --- |
| `Adicionar anexos` como link pequeno | Dropzone com CTA, instrução e limite | Torna a ação encontrável e reduz dúvida sobre como enviar. |
| Linha com ícone e nome | Card com tipo, tamanho e estado | Ajuda a confirmar rapidamente se a evidência correta foi enviada. |
| Preview de imagem inline sem ação | Thumbnail clicável + lightbox | Permite inspeção sem sair do detalhe da task. |
| Lista vazia sem contexto | Empty state orientado a evidências | Explica o valor do bloco antes do primeiro upload. |

## Validação

- `npm.cmd test`: 50/50.
- `npm.cmd run build`: passou; webresource inline validado.
- QA de navegador: pendente. O Playwright não iniciou por `EPERM` ao abrir o daemon em `C:\Users\mendo\AppData\Local\ms-playwright\daemon`.
