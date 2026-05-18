# Senior Scout 360 (Scout V2)

Aplicação web de inteligência comercial para operação consultiva, composta por quatro domínios principais:
- **War Room**: assistente comercial orientado à documentação oficial da Senior.
- **Scout**: investigação de contas com pipeline de evidências e scoring PORTA.
- **Radar**: inteligência competitiva e tendências de mercado.
- **CRM**: gestão de contas e pipeline comercial.
- **Dashboard**: visão consolidada dos indicadores operacionais.

## Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript.
- **UI**: Tailwind CSS, Radix UI, Lucide, Recharts, Sonner.
- **Backend/API**: Route Handlers do Next.js (`src/app/api/**`).
- **Banco**: Prisma ORM + SQLite (`db/custom.db`).
- **IA e pesquisa**: `z-ai-web-dev-sdk` (chat + funções `web_search` e `page_reader`), BrasilAPI para enriquecimento de CNPJ.
- **Runtime**: Bun (scripts de start em produção).

## Requisitos

- Node/Bun compatível com Next.js 16.
- Banco SQLite local.
- Credenciais/configuração do `z-ai-web-dev-sdk` no ambiente de execução.

## Setup

1. Instalar dependências:
```bash
bun install
```

2. Configurar ambiente:
```bash
cp .env .env.local
```

3. Validar variável obrigatória:
```env
DATABASE_URL=file:/home/z/my-project/db/custom.db
```

4. Sincronizar schema:
```bash
bun run db:generate
bun run db:push
```

5. Subir em desenvolvimento:
```bash
bun run dev
```

## Comandos

- `bun run dev`: sobe app em `http://localhost:3000` e grava logs em `dev.log`.
- `bun run build`: build de produção e preparação de artefatos standalone.
- `bun run start`: inicia servidor standalone com Bun e grava em `server.log`.
- `bun run lint`: validação ESLint.
- `bun run db:generate`: gera client Prisma.
- `bun run db:push`: aplica schema no banco.
- `bun run db:migrate`: cria/aplica migração em dev.
- `bun run db:reset`: reset completo de migrações (destrutivo).

## Variáveis de Ambiente

## Obrigatórias

- `DATABASE_URL`: conexão do Prisma (SQLite).

## Inferidas (não declaradas explicitamente no código)

- Credenciais da SDK `z-ai-web-dev-sdk` para chamadas de IA e funções externas.

> Suposição explícita: como `ZAI.create()` é usado sem parâmetros em múltiplas rotas, as credenciais vêm de variáveis de ambiente externas à base de código.

## Arquitetura (resumo)

- **Camada UI**: componentes em `src/components/*` e página raiz em `src/app/page.tsx`.
- **Camada API**: handlers REST/SSE em `src/app/api/**/route.ts`.
- **Camada de domínio**:
  - Scout: investigação factual + qualidade + PORTA.
  - War Room: recuperação de documentação + geração comercial guiada.
  - Radar: busca competitiva + sumarização + persistência.
  - CRM/Dashboard: operação e métricas comerciais.
- **Persistência**: Prisma Client singleton (`src/lib/db.ts`) + modelos em `prisma/schema.prisma`.
- **Serviços auxiliares**: pipeline de pesquisa em `src/lib/research-engine.ts` com timeout/retry/evidence gate.

Para detalhamento completo, ver:
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/HANDOFF.md`

## Estrutura de Pastas

- `src/app`: app router e endpoints API.
- `src/components`: views de produto e componentes UI.
- `src/lib`: acesso a banco e engine de pesquisa.
- `prisma`: schema de dados.
- `db`: arquivo SQLite local.
- `docs`: documentação operacional e handoff.
- `examples`: exemplos isolados (não críticos para runtime principal).

## Troubleshooting

- **Erro Prisma (`DATABASE_URL` inválida)**
  - Validar `.env`/`.env.local` e caminho da base SQLite.

- **Endpoints de IA retornando erro 500**
  - Verificar credenciais/configuração da SDK `z-ai-web-dev-sdk` no ambiente.

- **Scout falhando por evidência insuficiente**
  - Comportamento esperado do evidence gate; testar com nome de empresa mais específico e/ou CNPJ.

- **Radar sem resultados**
  - O endpoint retorna `entries: []` quando busca externa não encontra fontes úteis; ajustar query/setor/categoria.

- **War Room com baixa confiança**
  - Quando há poucas fontes completas, o endpoint sinaliza confiança menor e lacunas.

- **PortaScore ausente em investigação**
  - Esperado para investigações não concluídas ou sem evidência mínima.
