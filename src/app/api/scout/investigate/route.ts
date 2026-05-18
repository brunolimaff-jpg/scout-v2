import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// ============================================================
// AGRO SUB-PLAYBOOKS
// ============================================================
const AGRO_SUB_PLAYBOOKS: Record<string, {
  label: string;
  searchTerms: string[];
  scoreHints: string;
  seniorModules: string[];
  painPoints: string[];
}> = {
  produtor_larga_escala: {
    label: 'Grupo Agrícola de Larga Escala',
    searchTerms: ['hectares cultivados', 'área plantada', 'unidades produtivas', 'fazendas', 'safra', 'culturas', 'armazenagem', 'verticalização'],
    scoreHints: 'Alta complexidade operacional (O≥7), porte grande (P≥7), tecnologia variável mas tende a necessidade (T≥6). Operações multi-unidade, multi-cultura, multi-estado.',
    seniorModules: ['Gestão Agrícola', 'Contábil', 'Financeiro', 'Estoque', 'Compras', 'Vendas', 'BI', 'Manutenção de Ativos', 'Logística'],
    painPoints: ['Gestão multi-unidade', 'Rastreabilidade', 'Controle de estoques agrícolas', 'Planejamento de safra', 'Gestão de ativos/máquinas', 'Compliance fiscal', 'ESG/reportes', 'Logística escoamento'],
  },
  cooperativa: {
    label: 'Cooperativa Agropecuária',
    searchTerms: ['cooperativa', 'cooperados', 'recepção', 'beneficiamento', 'armazém', 'unidade de recebimento'],
    scoreHints: 'Operação complexa com múltiplas unidades (O≥7), porte grande (P≥7), alta necessidade de gestão (T≥5). Frota, armazenagem, financeiro cooperativista.',
    seniorModules: ['Gestão Agrícola', 'Contábil', 'Financeiro', 'Estoque', 'Compras', 'Vendas', 'BI', 'Logística', 'Frota'],
    painPoints: ['Gestão de cooperados', 'Recepção e classificação', 'Armazenagem', 'Frota de transporte', 'Rateio cooperativista', 'Compliance'],
  },
  revenda_insumos: {
    label: 'Revenda de Insumos Agrícolas',
    searchTerms: ['distribuidor insumos', 'revenda agrícola', 'defensivos', 'fertilizantes', 'sementes', 'armazém'],
    scoreHints: 'Operação comercial com estoque complexo (O≥6), porte médio-grande (P≥5), forte necessidade de gestão comercial e estoque (T≥5).',
    seniorModules: ['Vendas', 'Estoque', 'Compras', 'Financeiro', 'Contábil', 'BI', 'Frota'],
    painPoints: ['Gestão de estoque sazonal', 'Rastreabilidade defensivos', 'Consignação', 'Prazo safra', 'Logística entrega'],
  },
  cerealista: {
    label: 'Cerealista/Armazenagem',
    searchTerms: ['armazém grãos', 'recepção grãos', 'secagem', 'beneficiamento', 'silos', 'expedição'],
    scoreHints: 'Operação logística complexa (O≥7), porte médio-grande (P≥6), forte necessidade de estoque e qualidade (T≥5).',
    seniorModules: ['Estoque', 'Compras', 'Vendas', 'Financeiro', 'Contábil', 'BI', 'Logística', 'Qualidade'],
    painPoints: ['Controle de qualidade', 'Gestão de silos/armazéns', 'Secagem/beneficiamento', 'Prazo e armazenagem', 'Rastreabilidade'],
  },
  trading: {
    label: 'Trading Agrícola',
    searchTerms: ['comercialização grãos', 'exportação', 'commodities', 'hedge', 'C&F', 'FOB'],
    scoreHints: 'Operação financeira e comercial intensa (O≥8), porte grande (P≥7), necessidade de BI e gestão avançada (T≥7).',
    seniorModules: ['Vendas', 'Compras', 'Financeiro', 'Contábil', 'BI', 'Logística', 'Câmbio'],
    painPoints: ['Gestão de risco', 'Hedge', 'Câmbio', 'Logística escoamento', 'Compliance exportação', 'Prazos complexos'],
  },
  agroindustria: {
    label: 'Agroindústria',
    searchTerms: ['industrialização', 'processamento', 'beneficiamento', 'fábrica', 'planta industrial', 'produção'],
    scoreHints: 'Alta complexidade (O≥8), porte grande (P≥7), processo industrial (T≥6). Produção + agrícola.',
    seniorModules: ['Produção', 'Estoque', 'Compras', 'Vendas', 'Financeiro', 'Contábil', 'BI', 'Qualidade', 'Manutenção'],
    painPoints: ['Gestão de produção', 'Rastreabilidade', 'Qualidade', 'Cadeia produtiva integrada', 'Compliance'],
  },
  pecuaria: {
    label: 'Pecuária',
    searchTerms: ['rebanho', 'cabeças', 'confinamento', 'pecuária', 'engorda', 'cria', 'recría'],
    scoreHints: 'Operação de gestão de rebanho (O≥6), porte pelo número de cabeças (P≥5), tecnologia emergente (T≥4).',
    seniorModules: ['Gestão Pecuária', 'Contábil', 'Financeiro', 'Estoque', 'Compras', 'BI', 'Manutenção'],
    painPoints: ['Gestão de rebanho', 'Rastreabilidade animal', 'Nutrição/sanidade', 'Confinamento', 'Compliance IBAMA/ICMbio'],
  },
  usina: {
    label: 'Usina/Açúcar e Álcool',
    searchTerms: ['usina', 'safra cana', 'etanol', 'açúcar', 'cogeração', 'moagem'],
    scoreHints: 'Alta complexidade industrial + agrícola (O≥9), porte muito grande (P≥8), tecnologia avançada (T≥7).',
    seniorModules: ['Produção', 'Gestão Agrícola', 'Contábil', 'Financeiro', 'Estoque', 'Compras', 'Vendas', 'BI', 'Manutenção', 'Qualidade'],
    painPoints: ['Planejamento de safra', 'Gestão industrial', 'Cogeração', 'Logística', 'Compliance ambiental', 'Qualidade'],
  },
  regenerativa: {
    label: 'Produção Regenerativa/Sustentável',
    searchTerms: ['agricultura regenerativa', 'sustentável', 'ESG', 'carbono', 'CRA', 'certificação', 'orgânico', 'biodiversidade'],
    scoreHints: 'Complexidade ESG adicional (O≥7), porte variável (P≥5), forte necessidade de rastreabilidade e reporte (T≥6).',
    seniorModules: ['Gestão Agrícola', 'BI', 'Contábil', 'Financeiro', 'ESG', 'Rastreabilidade', 'Compliance'],
    painPoints: ['Rastreabilidade ESG', 'Certificações', 'Reporte carbono', 'CRA/créditos', 'Compliance', 'Diferenciação comercial'],
  },
  mista: {
    label: 'Grupo Misto/Complexo',
    searchTerms: ['grupo', 'holding', 'diversificado', 'verticalizado', 'múltiplas atividades', 'conglomerado'],
    scoreHints: 'Máxima complexidade (O≥9), porte grande (P≥8), necessidade de gestão corporativa (T≥7).',
    seniorModules: ['ERP Completo', 'BI', 'Contábil', 'Financeiro', 'Gestão Agrícola', 'Estoque', 'Compras', 'Vendas', 'Manutenção', 'Logística', 'ESG'],
    painPoints: ['Integração multi-empresa', 'Consolidação contábil', 'Gestão de holdings', 'ESG corporativo', 'BI consolidado', 'Governança'],
  },
};

// ============================================================
// FORBIDDEN GENERIC PHRASES (anti-hallucination check)
// ============================================================
const FORBIDDEN_PHRASES = [
  'empresa de médio porte',
  'crescimento gradual',
  'foco em modernização',
  'presença consolidada',
  'maturidade digital moderada',
  'processos bem estabelecidos',
  'gestão aberta à inovação',
  'provavelmente utiliza soluções pontuais',
  'potencial de ROI moderado para alto',
  'setor em expansão',
  'tendência de digitalização',
  'empresa tradicional',
  'buscando modernizar',
  'em processo de transformação digital',
];

// ============================================================
// Pipeline Step 1: Multi-query Web Search
// ============================================================
async function searchCompanyData(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  cnpj?: string
): Promise<Array<{ title: string; url: string; snippet: string; query: string }>> {
  const queries = [
    `"${companyName}" grupo empresa Brasil atuação`,
    `"${companyName}" fundação história origem`,
    `"${companyName}" faturamento receita área hectares produção`,
    `"${companyName}" unidades produtivas fazendas operações estados`,
    `"${companyName}" tecnologia ERP sistemas gestão software`,
    `"${companyName}" certificação ESG sustentável regenerativa CRA`,
  ];

  if (cnpj) {
    queries.push(`"${cnpj}" receita federal CNPJ`);
  }

  const allResults: Array<{ title: string; url: string; snippet: string; query: string }> = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    try {
      const searchResponse = await zai.functions.invoke('web_search', {
        query,
        num: 10,
      });

      let results: Array<{ title?: string; url?: string; snippet?: string }> = [];
      if (Array.isArray(searchResponse)) {
        results = searchResponse;
      } else if (searchResponse && typeof searchResponse === 'object') {
        const resp = searchResponse as Record<string, unknown>;
        results = (resp.results || resp.items || []) as Array<{ title?: string; url?: string; snippet?: string }>;
      }

      for (const r of results) {
        const url = r.url || '';
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);
        allResults.push({
          title: r.title || '',
          url,
          snippet: r.snippet || '',
          query,
        });
      }
    } catch {
      // Continue with other queries
    }
  }

  return allResults;
}

// ============================================================
// Pipeline Step 2: Classify company sector and sub-type
// ============================================================
async function classifyCompany(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  searchResults: Array<{ title: string; snippet: string }>
): Promise<{ sector: string; subSector: string; companyType: string; scale: string; complexity: string }> {
  const contextSnippets = searchResults
    .slice(0, 15)
    .map((r) => `${r.title}: ${r.snippet}`)
    .join('\n');

  const result = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `Você é um classificador de empresas brasileiras para fins comerciais/ERP.

Com base nas evidências abaixo, classifique a empresa "${companyName}":

1. sector: Um de: agro, construction, retail, industry, services, logistics
2. subSector: Para agro, um de: produtor_larga_escala, cooperativa, revenda_insumos, cerealista, trading, agroindustria, pecuaria, usina, regenerativa, mista
   Para outros setores, descreva o subtipo em snake_case
3. companyType: tipo da empresa (ex: "grupo agrícola", "cooperativa", "S.A.", "LTDA", etc.)
4. scale: "micro" | "pequena" | "media" | "grande" | "muito_grande" — SOMENTE se houver evidência de porte
5. complexity: "baixa" | "media" | "alta" | "muito_alta" — SOMENTE se houver evidência de complexidade operacional

REGRAS:
- Se não houver evidência suficiente para porte, use "indefinido_sem_evidencia"
- Para agro, NÃO classifique tudo como genérico. Diferencie produtor de revenda de trading de cooperativa.
- Um "grupo" com múltiplas atividades provavelmente é "mista"

EVIDÊNCIAS:
${contextSnippets}

Responda APENAS com JSON válido, sem markdown:`,
      },
      { role: 'user', content: `Classifique a empresa ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });

  const raw = result.choices?.[0]?.message?.content?.trim() || '{}';
  const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return { sector: 'services', subSector: 'indefinido', companyType: 'indefinido', scale: 'indefinido_sem_evidencia', complexity: 'indefinido_sem_evidencia' };
  }
}

// ============================================================
// Pipeline Step 3: Extract facts, hypotheses, gaps from evidence
// ============================================================
async function extractEvidence(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  searchResults: Array<{ title: string; url: string; snippet: string }>,
  classification: Record<string, string>
): Promise<Array<{ type: string; claim: string; source: string; confidence: string }>> {
  const contextSnippets = searchResults
    .slice(0, 20)
    .map((r, i) => `[${i + 1}] ${r.title}: ${r.snippet} (${r.url})`)
    .join('\n');

  const result = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `Você é um analista de inteligência comercial. Extraia FATOS, HIPÓTESES e LACUNAS sobre a empresa "${companyName}" (classificada como ${classification.sector} / ${classification.subSector}).

TIPOS:
- fact: algo encontrado em fonte pública com evidência clara (site oficial, notícia, registro)
- hypothesis: inferência baseada em sinais, mas sem confirmação direta
- recommendation: ação comercial sugerida
- gap: dado importante que NÃO foi encontrado

REGRAS ESTRITAS:
1. NÃO invente dados. Se não encontrou, marque como gap.
2. NÃO use frases genéricas como "empresa de médio porte", "maturidade digital moderada", "foco em modernização".
3. Cada claim deve ser específica e verificável.
4. Se não houver evidência de faturamento, NÃO estime. Marque como gap.
5. Se não houver evidência de funcionários, NÃO estime. Marque como gap.
6. Confidence: "high" (fonte direta), "medium" (inferência forte), "low" (especulação)

Para GRUPOS AGRÍCOLAS DE LARGA ESCALA, procure especificamente:
- Hectares cultivados (gap se não encontrado)
- Culturas principais (gap se não encontrado)
- Unidades produtivas / fazendas (gap se não encontrado)
- Estados de atuação (gap se não encontrado)
- Armazenagem própria (gap se não encontrado)
- Pecuária (gap se não encontrado)
- Certificações (gap se não encontrado)
- Práticas ESG/regenerativas (gap se não encontrado)
- Verticalização (gap se não encontrado)
- Estrutura operacional (gap se não encontrado)
- Sinais de tecnologia/ERP (gap se não encontrado)
- Decisores prováveis (gap se não encontrado)

EVIDÊNCIAS COLETADAS:
${contextSnippets}

Responda APENAS com JSON array, sem markdown:
[
  { "type": "fact|hypotesis|recommendation|gap", "claim": "...", "source": "url ou descrição da fonte", "confidence": "high|medium|low" }
]`,
      },
      { role: 'user', content: `Extraia evidências sobre ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });

  const raw = result.choices?.[0]?.message?.content?.trim() || '[]';
  const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return [{ type: 'gap', claim: 'Não foi possível extrair evidências estruturadas', source: 'sistema', confidence: 'low' }];
  }
}

// ============================================================
// Pipeline Step 4: Generate auditable PORTA score
// ============================================================
async function generatePortaScore(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  classification: Record<string, string>,
  evidences: Array<{ type: string; claim: string; source: string; confidence: string }>,
  searchResults: Array<{ title: string; snippet: string }>
): Promise<{
  porte: number; operacao: number; retorno: number; tecnologia: number; adocao: number;
  total: number; notes: Record<string, { score: number; justification: string; evidences: string[]; confidence: string; gaps: string[]; penalty: number }>;
}> {
  const evidenceText = evidences
    .filter(e => e.type === 'fact' || e.type === 'hypotesis')
    .map(e => `[${e.type.toUpperCase()} conf=${e.confidence}] ${e.claim} (fonte: ${e.source})`)
    .join('\n');

  const gapText = evidences
    .filter(e => e.type === 'gap')
    .map(e => e.claim)
    .join('\n');

  const result = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `Você é um analista de score PORTA para soluções Senior. Calcule o score para "${companyName}" (${classification.sector} / ${classification.subSector}).

SCORE PORTA:
- P (Porte): Peso 0.10 — Tamanho/escala da empresa (0-10)
- O (Operação): Peso 0.25 — Complexidade operacional (0-10)
- R (Retorno): Peso 0.10 — Potencial de ROI para Senior (0-10)
- T (Tecnologia): Peso 0.30 — Prontidão/necessidade tecnológica (0-10)
- A (Adoção): Peso 0.25 — Prontidão para adoção Senior (0-10)

REGRAS ESTRITAS:
1. CADA nota deve ter JUSTIFICATIVA baseada em EVIDÊNCIA.
2. Se não houver evidência para uma dimensão, a nota NÃO pode ser 5.0, 6.0 ou 7.0 (chute médio). Deve ser baixa (1-3) com lacuna declarada.
3. Penalidade: Para cada lacuna relevante na dimensão, subtraia -0.5 a -2.0 do score.
4. NÃO dê nota "parece razoável" — dê nota baseada em FATOS.
5. Para GRANDES GRUPOS AGRÍCOLAS: porte alto (P≥7), operação muito complexa (O≥8), tecnologia variável mas necessidade alta (T≥6).
6. Cada dimensão deve listar: evidências usadas, lacunas, e penalidade aplicada.

EVIDÊNCIAS:
${evidenceText}

LACUNAS:
${gapText}

Setor: ${classification.sector}
Subtipo: ${classification.subSector}
Porte indicado: ${classification.scale}
Complexidade: ${classification.complexity}

Responda APENAS com JSON válido, sem markdown:
{
  "porte": 0-10,
  "operacao": 0-10,
  "retorno": 0-10,
  "tecnologia": 0-10,
  "adocao": 0-10,
  "notes": {
    "porte": { "score": X, "justification": "...", "evidences": ["..."], "confidence": "high|medium|low", "gaps": ["..."], "penalty": 0 },
    "operacao": { "score": X, "justification": "...", "evidences": ["..."], "confidence": "high|medium|low", "gaps": ["..."], "penalty": 0 },
    "retorno": { "score": X, "justification": "...", "evidences": ["..."], "confidence": "high|medium|low", "gaps": ["..."], "penalty": 0 },
    "tecnologia": { "score": X, "justification": "...", "evidences": ["..."], "confidence": "high|medium|low", "gaps": ["..."], "penalty": 0 },
    "adocao": { "score": X, "justification": "...", "evidences": ["..."], "confidence": "high|medium|low", "gaps": ["..."], "penalty": 0 }
  }
}`,
      },
      { role: 'user', content: `Calcule o Score PORTA para ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });

  const raw = result.choices?.[0]?.message?.content?.trim() || '{}';
  const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(jsonStr);
    const porte = Math.min(10, Math.max(0, Number(parsed.porte) || 0));
    const operacao = Math.min(10, Math.max(0, Number(parsed.operacao) || 0));
    const retorno = Math.min(10, Math.max(0, Number(parsed.retorno) || 0));
    const tecnologia = Math.min(10, Math.max(0, Number(parsed.tecnologia) || 0));
    const adocao = Math.min(10, Math.max(0, Number(parsed.adocao) || 0));
    const total = Math.round((porte * 0.10 + operacao * 0.25 + retorno * 0.10 + tecnologia * 0.30 + adocao * 0.25) * 100) / 100;
    return { porte, operacao, retorno, tecnologia, adocao, total, notes: parsed.notes || {} };
  } catch {
    return { porte: 0, operacao: 0, retorno: 0, tecnologia: 0, adocao: 0, total: 0, notes: {} };
  }
}

// ============================================================
// Pipeline Step 5: Generate fact-based summary
// ============================================================
async function generateSummary(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  classification: Record<string, string>,
  evidences: Array<{ type: string; claim: string; source: string; confidence: string }>
): Promise<string> {
  const facts = evidences.filter(e => e.type === 'fact').map(e => e.claim).join('; ');
  const hypotheses = evidences.filter(e => e.type === 'hypotesis').map(e => `[HIPÓTESE] ${e.claim}`).join('; ');
  const gaps = evidences.filter(e => e.type === 'gap').map(e => `[LACUNA] ${e.claim}`).join('; ');

  const result = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `Você é um analista de inteligência comercial da Senior Sistemas. Escreva um resumo executivo BASEADO EM FATOS sobre "${companyName}".

CLASSIFICAÇÃO: ${classification.sector} / ${classification.subSector}
TIPO: ${classification.companyType}
PORTE: ${classification.scale}
COMPLEXIDADE: ${classification.complexity}

FATOS ENCONTRADOS: ${facts}
HIPÓTESES: ${hypotheses}
LACUNAS: ${gaps}

REGRAS ESTRITAS:
1. O resumo deve ser BASEADO NOS FATOS. Cada afirmação deve ter base nas evidências.
2. NÃO use frases genéricas proibidas: "empresa de médio porte", "crescimento gradual", "maturidade digital moderada", etc.
3. Quando algo for hipótese, diga explicitamente: "Parece que..." ou "Há indícios de..."
4. Quando algo for lacuna, diga: "Não foi possível verificar..." ou "Não encontramos informação sobre..."
5. Seja ESPECÍFICO: cite culturas, estados, áreas, unidades — quando houver evidência.
6. NÃO estime faturamento, funcionários ou porte sem evidência.
7. Para grupos agro de larga escala, reconheça a escala e complexidade real — não minimize.

Escreva o resumo em 3-5 parágrafos objetivos.`,
      },
      { role: 'user', content: `Escreva o resumo executivo sobre ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });

  return result.choices?.[0]?.message?.content || 'Resumo não disponível.';
}

// ============================================================
// Pipeline Step 6: Generate commercial thesis
// ============================================================
async function generateCommercialThesis(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  classification: Record<string, string>,
  evidences: Array<{ type: string; claim: string; source: string; confidence: string }>,
  subSector: string
): Promise<Record<string, unknown>> {
  const playbook = AGRO_SUB_PLAYBOOKS[subSector] || AGRO_SUB_PLAYBOOKS.mista;
  const facts = evidences.filter(e => e.type === 'fact').map(e => e.claim).join('; ');
  const gaps = evidences.filter(e => e.type === 'gap').map(e => e.claim).join('; ');

  const result = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `Você é um consultor comercial da Senior Sistemas. Gere uma tese comercial para "${companyName}".

CLASSIFICAÇÃO: ${classification.sector} / ${subSector} (${playbook.label})
MÓDULOS SENIOR RELEVANTES: ${playbook.seniorModules.join(', ')}
DORES TÍPICAS: ${playbook.painPoints.join(', ')}

FATOS: ${facts}
LACUNAS: ${gaps}

Gere JSON com:
{
  "thesis": "Tese comercial principal (2-3 frases, baseada em fatos)",
  "seniorModules": ["módulos Senior recomendados baseados em evidências"],
  "painPoints": ["dores prováveis baseadas em sinais + playbook"],
  "decisionMakers": ["cargos prováveis de decisor, ou 'LACUNA: não identificado'"],
  "risks": ["riscos comerciais"],
  "nextSteps": ["próximos passos práticos"],
  "smartQuestions": ["5 perguntas inteligentes para reunião com o cliente, baseadas no que sabemos E nas lacunas"]
}`,
      },
      { role: 'user', content: `Gere tese comercial para ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });

  const raw = result.choices?.[0]?.message?.content?.trim() || '{}';
  const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return { thesis: 'Tese não disponível', seniorModules: [], painPoints: [], decisionMakers: [], risks: [], nextSteps: [], smartQuestions: [] };
  }
}

// ============================================================
// Pipeline Step 7: Quality check (anti-hallucination filter)
// ============================================================
async function qualityCheck(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  summary: string,
  evidences: Array<{ type: string; claim: string; source: string; confidence: string }>,
  classification: Record<string, string>
): Promise<{ passed: boolean; issues: string[]; rewrittenSummary?: string }> {
  const issues: string[] = [];

  // Check for forbidden phrases
  const lowerSummary = summary.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lowerSummary.includes(phrase.toLowerCase())) {
      issues.push(`Frase genérica proibida encontrada: "${phrase}"`);
    }
  }

  // Check for claims without evidence
  const facts = evidences.filter(e => e.type === 'fact');
  const gaps = evidences.filter(e => e.type === 'gap');

  if (facts.length === 0 && gaps.length > 3) {
    issues.push('Muitas lacunas e nenhum fato — investigação com baixo grounding');
  }

  if (classification.scale === 'indefinido_sem_evidencia') {
    // Check if summary claims size
    if (lowerSummary.includes('grande') || lowerSummary.includes('médio') || lowerSummary.includes('pequeno')) {
      issues.push('Resumo afirma porte sem evidência classificada');
    }
  }

  if (issues.length === 0) {
    return { passed: true, issues: [] };
  }

  // Rewrite summary to fix issues
  const rewriteResult = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `O seguinte resumo executivo tem problemas de qualidade. Reescreva REMOVENDO:
${issues.join('\n')}

REGRAS:
- Substitua afirmações sem evidência por "Não foi possível verificar..."
- Remova frases genéricas
- Mantenha apenas o que tem base factual
- Se não souber o porte, não afirme porte

RESUMO ORIGINAL:
${summary}

Reescreva o resumo corrigido:`,
      },
      { role: 'user', content: 'Reescreva o resumo' },
    ],
    thinking: { type: 'disabled' },
  });

  const rewritten = rewriteResult.choices?.[0]?.message?.content || summary;

  return { passed: false, issues, rewrittenSummary: rewritten };
}

// ============================================================
// POST /api/scout/investigate — Full Factual Grounding Pipeline
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyName, cnpj } = body as { companyName: string; cnpj?: string };

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return NextResponse.json(
        { error: 'companyName is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const trimmedName = companyName.trim();

    // Create investigation in pending state
    const investigation = await db.scoutInvestigation.create({
      data: {
        companyName: trimmedName,
        cnpj: cnpj?.trim() || null,
        status: 'investigating',
      },
    });

    try {
      const zai = await ZAI.create();

      // Step 1: Search company data (multiple queries)
      console.log(`[Scout] Step 1: Searching data for "${trimmedName}"...`);
      const searchResults = await searchCompanyData(zai, trimmedName, cnpj);

      // Step 2: Classify company
      console.log(`[Scout] Step 2: Classifying "${trimmedName}"...`);
      const classification = await classifyCompany(zai, trimmedName, searchResults);

      // Step 3: Extract evidence
      console.log(`[Scout] Step 3: Extracting evidence for "${trimmedName}"...`);
      const evidenceList = await extractEvidence(zai, trimmedName, searchResults, classification);

      // Step 4: Generate PORTA score
      console.log(`[Scout] Step 4: Generating PORTA score for "${trimmedName}"...`);
      const portaResult = await generatePortaScore(zai, trimmedName, classification, evidenceList, searchResults);

      // Step 5: Generate summary
      console.log(`[Scout] Step 5: Generating summary for "${trimmedName}"...`);
      let summary = await generateSummary(zai, trimmedName, classification, evidenceList);

      // Step 6: Generate commercial thesis
      console.log(`[Scout] Step 6: Generating commercial thesis for "${trimmedName}"...`);
      const commercialThesis = await generateCommercialThesis(zai, trimmedName, classification, evidenceList, classification.subSector || 'mista');

      // Step 7: Quality check
      console.log(`[Scout] Step 7: Quality check for "${trimmedName}"...`);
      const qc = await qualityCheck(zai, summary, evidenceList, classification);
      if (!qc.passed && qc.rewrittenSummary) {
        summary = qc.rewrittenSummary;
      }

      // Save everything to database
      const updatedInvestigation = await db.scoutInvestigation.update({
        where: { id: investigation.id },
        data: {
          status: 'completed',
          summary,
          sector: classification.sector || null,
          subSector: classification.subSector || null,
          rawData: JSON.stringify({
            searches: searchResults.length,
            results: searchResults.slice(0, 30),
            searchedAt: new Date().toISOString(),
          }),
          evidences: JSON.stringify(evidenceList),
          classification: JSON.stringify(classification),
          commercialThesis: JSON.stringify(commercialThesis),
          sources: JSON.stringify(
            searchResults.slice(0, 20).map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
              type: 'web_search',
            }))
          ),
          qualityCheck: JSON.stringify(qc),
        },
      });

      // Save PORTA score
      const portaScore = await db.portaScore.create({
        data: {
          investigationId: investigation.id,
          porte: portaResult.porte,
          operacao: portaResult.operacao,
          retorno: portaResult.retorno,
          tecnologia: portaResult.tecnologia,
          adocao: portaResult.adocao,
          total: portaResult.total,
          sector: classification.sector || null,
          subSector: classification.subSector || null,
          notes: JSON.stringify(portaResult.notes),
        },
      });

      return NextResponse.json({
        investigation: updatedInvestigation,
        portaScore,
      });
    } catch (analysisError) {
      console.error('[Scout] Investigation failed:', analysisError);
      await db.scoutInvestigation.update({
        where: { id: investigation.id },
        data: {
          status: 'failed',
          rawData: JSON.stringify({
            error: analysisError instanceof Error ? analysisError.message : 'Unknown error',
            failedAt: new Date().toISOString(),
          }),
        },
      });

      return NextResponse.json(
        { error: 'Investigation failed', investigationId: investigation.id, details: analysisError instanceof Error ? analysisError.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Scout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
