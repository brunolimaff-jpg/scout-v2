# Arquitetura - Senior Scout 360

## Visão Geral

Aplicação monolítica em Next.js com separação lógica por domínios de negócio, persistência via Prisma/SQLite e orquestração de IA via `z-ai-web-dev-sdk`.

## Camadas

### 1. Interface (UI)
- Local: `src/app/page.tsx`, `src/components/*`.
- Responsável por:
  - Navegação entre módulos (`warroom`, `scout`, `radar`, `crm`, `dashboard`).
  - Estado local e chamadas `fetch` para API interna.
  - Renderização de progresso (SSE no Scout) e estados de erro/carregamento.

### 2. API (Application Layer)
- Local: `src/app/api/**/route.ts`.
- Padrões:
  - `NextRequest/NextResponse` para REST.
  - `ReadableStream` + SSE para investigação Scout.
  - Validação manual de payload/enum em cada endpoint.

### 3. Domínio
- **Scout**: investigação factual, classificação setorial, evidence gate, scoring PORTA, tese comercial e quality check.
- **War Room**: classificação de intenção, extração de termos, busca e leitura de documentação, resposta comercial estruturada.
- **Radar**: busca competitiva, deduplicação, síntese de insights e persistência de entradas.
- **CRM**: ciclo de conta com regras de integridade ligadas à investigação.
- **Dashboard**: agregação estatística para acompanhamento executivo.

### 4. Persistência
- `src/lib/db.ts`: Prisma singleton.
- `prisma/schema.prisma`: modelagem de dados (War Room, Scout, PORTA, CRM, Radar).
- Banco atual: SQLite (`DATABASE_URL`).

### 5. Integrações Externas
- `z-ai-web-dev-sdk`:
  - `chat.completions.create` para raciocínio/síntese.
  - `functions.invoke('web_search')` para busca web.
  - `functions.invoke('page_reader')` para leitura de páginas.
- BrasilAPI:
  - Enriquecimento de CNPJ no pipeline Scout.

## Fluxos de Dados

## Fluxo A - Scout (SSE)
1. Cliente envia `POST /api/scout/investigate` com `companyName` (+ `cnpj` opcional).
2. API cria investigação com status `investigating`.
3. Pipeline emite eventos SSE por estágio.
4. Coleta evidências (busca + CNPJ), classifica setor/subsetor.
5. Executa evidence gate:
   - Sem evidência mínima: falha e status `failed`.
6. Se aprovado:
   - Calcula PORTA (quando possível), gera resumo/tese, faz quality check.
7. Persiste investigação como `completed` somente no final.
8. Emite `final_response_ready`.

## Fluxo B - War Room
1. Cliente chama `POST /api/warroom/chat`.
2. API classifica intenção + extrai termos-chave.
3. Busca páginas em `documentacao.senior.com.br`.
4. Tenta conteúdo completo (`page_reader`), com fallback para snippet.
5. Gera resposta em formato comercial estruturado.
6. Persiste sessão, mensagens e fontes.
7. Retorna `confidence` e `gaps`.

## Fluxo C - Radar
1. Cliente chama `POST /api/radar/search`.
2. API monta queries orientadas ao contexto Senior.
3. Busca web, deduplica resultados.
4. LLM converte em até 5 entradas estruturadas.
5. Persiste em `RadarEntry`.

## Fluxo D - CRM
1. Criação de conta opcionalmente vinculada à investigação.
2. Regras impedem vinculação se investigação não estiver `completed` com PORTA válido.
3. Operações de atualização/exclusão mantêm consistência de pipeline comercial.

## Decisões Técnicas Identificadas

- **Integridade por status no Scout**: `completed` apenas no fim do pipeline; falhas são explicitamente `failed`.
- **Evidence-first**: sem fatos suficientes, a investigação é interrompida para evitar inferência fraca.
- **Defensive programming**: timeout, retry e fallback em chamadas externas.
- **Persistência de contexto no War Room**: cache de páginas (`DocumentationPage`) para reduzir custo/repetição.
- **Regra de negócio no backend**: bloqueio de criação CRM sem investigação concluída + PORTA.

## Modelo de Dados (alto nível)

- `ScoutInvestigation` 1:1 `PortaScore`
- `ScoutInvestigation` 1:0..1 `CrmAccount`
- `WarRoomSession` 1:N `WarRoomMessage`
- `WarRoomMessage` 1:N `WarRoomSource`
- `DocumentationPage` 1:N `DocumentationChunk` (chunking previsto, uso parcial no estado atual)

## Limites e Riscos Arquiteturais

- Ausência de autenticação/autorização nativa nos endpoints.
- SQLite limita escala concorrente para workloads maiores.
- Dependência forte de disponibilidade dos provedores externos (`web_search`, `page_reader`, LLM).
- Validação de contrato API sem schema central (ex.: Zod/OpenAPI), aumentando risco de drift.

## Suposições explícitas

- Deploy esperado atrás de camada externa (ex.: Caddy/reverse proxy) para hardening adicional.
- Credenciais da SDK de IA são injetadas por ambiente e não versionadas no repositório.
