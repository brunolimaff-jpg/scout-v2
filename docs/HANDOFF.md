# HANDOFF - Senior Scout 360

Data de referência: **2026-05-18**

## Status Atual

- Documentação base do projeto criada/atualizada:
  - `README.md`
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
  - `docs/HANDOFF.md`
- Mapeamento feito diretamente do código em `src/app/api/**`, `src/lib/**` e `prisma/schema.prisma`.
- Não houve alteração em código de produto fora de `README.md` e `docs/`.

## Escopo Coberto

- Visão geral funcional dos módulos War Room, Scout, Radar, CRM e Dashboard.
- Setup local, comandos, variáveis de ambiente e troubleshooting.
- Catálogo de endpoints com método, rota, payload e formato de resposta.
- Arquitetura por camadas, fluxos e decisões técnicas identificáveis no código.

## Pendências

- Formalizar contrato API em OpenAPI/Swagger (hoje não existe especificação versionada).
- Adicionar autenticação/autorização nos endpoints (atualmente públicos no app).
- Definir política de segurança para endpoint de manutenção: `POST /api/scout/investigations`.
- Consolidar variáveis de ambiente da SDK `z-ai-web-dev-sdk` em guia oficial do projeto.

## Riscos

- **P1**: ausência de auth em rotas sensíveis (CRUD + pipeline de IA).
- **P1**: endpoint de cleanup de Scout acessível sem proteção de role.
- **P2**: dependência de serviços externos pode degradar UX (timeouts/falhas intermitentes).
- **P2**: falta de schema contratual central pode gerar drift entre frontend e backend.
- **P3**: SQLite pode ser gargalo sob maior paralelismo em produção.

## Próximos Passos Recomendados

1. Implementar camada de autenticação para `/api/**`.
2. Restringir endpoint de manutenção Scout a contexto administrativo.
3. Publicar spec OpenAPI inicial e validar payloads com schema compartilhado.
4. Adicionar testes de contrato para endpoints críticos (`scout/investigate`, `warroom/chat`, `crm/accounts`).
5. Definir fallback operacional documentado quando provedores externos estiverem indisponíveis.

## Suposições Registradas

- Credenciais da SDK de IA são injetadas externamente; não há declaração explícita no repositório.
- Ambiente padrão de execução local usa SQLite conforme `.env` atual.
- Projeto em estado funcional de desenvolvimento com foco em fluxo interno e não hardening de produção.
