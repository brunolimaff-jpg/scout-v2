# API - Senior Scout 360

Base local padrão: `http://localhost:3000`

## Convenções

- Formato: JSON, exceto endpoint SSE de investigação.
- Erros padrão (quando tratados):
  - `400`: validação de payload/parâmetros.
  - `404`: recurso não encontrado.
  - `409`: conflito de unicidade/regra.
  - `500`: erro interno.

## Health/Root

### GET `/api`
- Resposta `200`:
```json
{ "message": "Hello, world!" }
```

## Dashboard

### GET `/api/dashboard/stats`
- Descrição: métricas agregadas de Scout, CRM e Radar.
- Resposta `200`:
```json
{
  "totalInvestigations": 0,
  "completedInvestigations": 0,
  "statusBreakdown": {},
  "avgPortaScore": 0,
  "portaAverages": null,
  "totalAccounts": 0,
  "stageBreakdown": {},
  "totalRadarEntries": 0,
  "categoryBreakdown": {},
  "recentActivity": [],
  "pipelineValue": 0
}
```

## Radar

### GET `/api/radar/entries`
- Descrição: lista entradas do radar ordenadas por criação desc.
- Resposta `200`:
```json
{ "entries": [ { "id": "...", "title": "..." } ] }
```

### POST `/api/radar/search`
- Descrição: executa busca externa, sumariza com LLM e persiste até 5 entradas.
- Payload:
```json
{
  "query": "string obrigatória",
  "category": "competitor|market_trend|regulation|technology|opportunity (opcional)",
  "sector": "agro|construction|retail|industry|services|logistics (opcional)"
}
```
- Resposta `200`:
```json
{ "entries": [ { "id": "...", "title": "...", "category": "..." } ] }
```
- Erros específicos:
  - `400` para `query` vazia/categoria ou setor inválidos.

## CRM

### GET `/api/crm/accounts`
- Descrição: lista contas com investigação e portaScore relacionados.
- Resposta `200`:
```json
{ "accounts": [ { "id": "...", "companyName": "..." } ] }
```

### POST `/api/crm/accounts`
- Descrição: cria conta CRM (com validação de regras quando ligada a investigação).
- Payload:
```json
{
  "companyName": "string obrigatória",
  "cnpj": "string opcional",
  "sector": "agro|construction|retail|industry|services|logistics",
  "contactName": "string",
  "contactEmail": "string",
  "contactPhone": "string",
  "stage": "lead|qualified|proposal|negotiation|closed_won|closed_lost",
  "nextStep": "string",
  "notes": "string",
  "potentialValue": 12345.67,
  "investigationId": "string"
}
```
- Resposta `201`:
```json
{ "account": { "id": "...", "companyName": "..." } }
```
- Regras adicionais:
  - Se `investigationId` informado, investigação deve existir, estar `completed`, possuir `portaScore` e não ter conta vinculada.
- Erros específicos:
  - `400`, `404`, `409` conforme regra violada.

### GET `/api/crm/accounts/:id`
- Descrição: busca conta por id.
- Resposta `200`: `{ "account": { ... } }`
- `404` se não existir.

### PATCH `/api/crm/accounts/:id`
- Descrição: atualização parcial da conta.
- Payload: qualquer subconjunto dos campos da criação.
- Resposta `200`: `{ "account": { ...atualizada } }`
- Erros específicos:
  - `400` se sem campos para atualizar ou enum inválido.
  - `404` se conta inexistente.

### DELETE `/api/crm/accounts/:id`
- Descrição: remove conta.
- Resposta `200`:
```json
{ "success": true, "message": "Account deleted" }
```

## Scout

### GET `/api/scout/investigations`
- Descrição: lista investigações; para status != `completed`, `portaScore` é limpo na resposta.
- Resposta `200`:
```json
{ "investigations": [ { "id": "...", "status": "completed" } ] }
```

### POST `/api/scout/investigations`
- Descrição: endpoint de limpeza de integridade (manutenção).
- Ações:
  - Marca investigações `completed` sem conteúdo como `failed`.
  - Remove PORTA órfão de investigação não concluída.
  - Remove contas CRM ligadas a investigação `failed`.
- Resposta `200`:
```json
{
  "message": "Data cleanup completed",
  "results": {
    "investigationsMarkedFailed": 0,
    "orphanScoresDeleted": 0,
    "failedCrmAccountsDeleted": 0
  }
}
```

### GET `/api/scout/investigations/:id`
- Descrição: busca investigação por id, incluindo `portaScore` e `crmAccount`.
- Comportamentos:
  - `failed`: retorna `errorState` com `canRetry: true`.
  - `pending`/`investigating`: retorna `errorState` de progresso.
  - status != `completed`: `portaScore` removido da resposta.
- Resposta `200`:
```json
{ "investigation": { "id": "...", "status": "..." }, "errorState": { "type": "..." } }
```

### DELETE `/api/scout/investigations/:id`
- Descrição: exclui investigação (cascade do `portaScore`).
- Resposta `200`:
```json
{ "success": true, "message": "Investigation deleted" }
```

### POST `/api/scout/investigate` (SSE)
- Descrição: pipeline completo de investigação com streaming de progresso.
- Payload:
```json
{ "companyName": "string obrigatória", "cnpj": "string opcional" }
```
- Content-Type de resposta: `text/event-stream`.
- Eventos relevantes:
  - `run_started`
  - `progress_stage_started`
  - `progress_stage_completed`
  - `progress_stage_warning`
  - `progress_stage_failed`
  - `evidence_found`
  - `confidence_updated`
  - `final_response_ready`
- Pipeline (ordem):
  - `preparing`, `cadastre`, `enriching`, `sector_detection`, `playbook`, `evidence`, `competition`, `porta`, `thesis`, `validating`, `saving`.
- Regra crítica:
  - Só marca `status = completed` no final do fluxo; falhas marcam `failed`.

## War Room

### GET `/api/warroom/sessions`
- Descrição: lista sessões com contagem de mensagens.
- Resposta `200`:
```json
{ "sessions": [ { "id": "...", "title": "...", "messageCount": 0 } ] }
```

### POST `/api/warroom/sessions`
- Descrição: cria sessão.
- Payload:
```json
{ "title": "string opcional" }
```
- Resposta `200`:
```json
{ "id": "...", "title": "Nova Sessão", "createdAt": "...", "updatedAt": "..." }
```

### GET `/api/warroom/sessions/:id`
- Descrição: retorna sessão com mensagens e fontes.
- Resposta `200`:
```json
{ "id": "...", "messages": [ { "id": "...", "sources": [] } ] }
```

### DELETE `/api/warroom/sessions/:id`
- Descrição: exclui sessão (cascade de mensagens/fontes).
- Resposta `200`:
```json
{ "success": true, "id": "..." }
```

### GET `/api/warroom/history?page=1&limit=20`
- Descrição: histórico paginado de mensagens em todas as sessões.
- Query params:
  - `page` (default `1`, mínimo `1`)
  - `limit` (default `20`, min `1`, max `100`)
- Resposta `200`:
```json
{
  "messages": [ { "id": "...", "sessionId": "...", "role": "assistant" } ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "hasMore": false
  }
}
```

### POST `/api/warroom/chat`
- Descrição: processa pergunta do usuário, busca documentação Senior, gera resposta comercial estruturada e persiste sessão/mensagens/fontes.
- Payload:
```json
{ "sessionId": "string opcional", "message": "string obrigatória" }
```
- Resposta `200`:
```json
{
  "sessionId": "...",
  "userMessageId": "...",
  "assistantMessageId": "...",
  "answer": "...",
  "intent": "documentation|error|config|step_by_step|concept|integration|business_rule|commercial|client_doubt|unrelated",
  "confidence": "high|medium|low",
  "keyTerms": {},
  "sources": [ { "id": "...", "url": "...", "relevance": 0.85 } ],
  "gaps": []
}
```
- Erros específicos:
  - `400` para `message` ausente/vazia.

## Suposições explícitas

- Autenticação/autorização não está implementada nos endpoints atuais.
- Não há versionamento de API (`/v1`) no estado atual.
- Endpoints de manutenção (`POST /api/scout/investigations`) devem ser restritos em produção via camada externa (proxy/WAF/auth), pois hoje estão públicos no app.
