# Migração de identidade da Central

Ambiente: Dataverse DEV (`org23b93544`)

## Resultado

Foi criado o lookup `cr40f_usuariodataverse` em `cr40f_funcionarios`, relacionado a `systemuser`. O conector aplicou o prefixo da tabela (`cr40f_`); o nome solicitado `new_usuariodataverse` não foi aceito pela operação de metadata.

Correspondências únicas aplicadas por `cr40f_emailmicrosoft`:

- Carlos Alberto de Paula Júnior → `betinhos@betinhos.onmicrosoft.com`
- Deborah Keila de Paula → `deborah.keila@betinhos.onmicrosoft.com`
- Juliana Rodrigues de Paula → `juliana.rodrigues@betinhos.onmicrosoft.com`
- Renan Rodrigues Mendonça dos Santos → `noreply@betinhos.onmicrosoft.com`

## Correção manual necessária

- Betinho: e-mail Microsoft ausente.
- Empresa: e-mail Microsoft ausente.
- Edneia de Oliveira Rodrigues de Paula: `edneiadepaula63@gmail.com` não encontrou `systemuser.internalemailaddress` correspondente.

Nenhum registro duplicado ou sem correspondência foi atualizado.
