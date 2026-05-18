import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import {
  executeResearch,
  evaluateEvidence,
  type ResearchProgressCallback,
  type BrasilAPICnpjData,
  type SearchResult,
  type ExtractedFact,
  type ValidatedSource,
} from '@/lib/research-engine';

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
    scoreHints: 'Alta complexidade operacional (O≥7), porte grande (P≥7), tecnologia variável mas tende a necessidade (T≥6).',
    seniorModules: ['Gestão Agrícola', 'Contábil', 'Financeiro', 'Estoque', 'Compras', 'Vendas', 'BI', 'Manutenção de Ativos', 'Logística'],
    painPoints: ['Gestão multi-unidade', 'Rastreabilidade', 'Controle de estoques agrícolas', 'Planejamento de safra', 'Gestão de ativos/máquinas', 'Compliance fiscal', 'ESG/reportes', 'Logística escoamento'],
  },
  cooperativa: {
    label: 'Cooperativa Agropecuária',
    searchTerms: ['cooperativa', 'cooperados', 'recepção', 'beneficiamento', 'armazém', 'unidade de recebimento'],
    scoreHints: 'Operação complexa com múltiplas unidades (O≥7), porte grande (P≥7), alta necessidade de gestão (T≥5).',
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
    scoreHints: 'Alta complexidade (O≥8), porte grande (P≥7), processo industrial (T≥6).',
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
// FORBIDDEN GENERIC PHRASES
// ============================================================
const FORBIDDEN_PHRASES = [
  'empresa de médio porte', 'crescimento gradual', 'foco em modernização',
  'presença consolidada', 'maturidade digital moderada', 'processos bem estabelecidos',
  'gestão aberta à inovação', 'provavelmente utiliza soluções pontuais',
  'potencial de ROI moderado para alto', 'setor em expansão', 'tendência de digitalização',
  'empresa tradicional', 'buscando modernizar', 'em processo de transformação digital',
];

// ============================================================
// SSE Event Helper
// ============================================================
function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ============================================================
// Pipeline stages — HONEST descriptions only
// ============================================================
const PIPELINE_STAGES = [
  { id: 'preparing', label: 'Preparando investigação', message: 'Planejando consultas e extraindo parâmetros...' },
  { id: 'cadastre', label: 'Consultando dados cadastrais', message: 'Buscando CNPJ e dados oficiais...' },
  { id: 'enriching', label: 'Pesquisando fontes', message: 'Consultando múltiplas fontes de informação...' },
  { id: 'sector_detection', label: 'Detectando setor', message: 'Cruzando evidências para classificar o setor...' },
  { id: 'playbook', label: 'Selecionando playbook', message: 'Escolhendo lente setorial...' },
  { id: 'evidence', label: 'Extraindo evidências', message: 'Separando fatos de hipóteses e lacunas...' },
  { id: 'competition', label: 'Mapeando concorrência', message: 'Buscando sinais competitivos reais...' },
  { id: 'porta', label: 'Avaliando PORTA', message: 'Calculando score com evidências por dimensão...' },
  { id: 'thesis', label: 'Montando tese comercial', message: 'Construindo análise baseada em evidências...' },
  { id: 'validating', label: 'Validando resultado', message: 'Verificando qualidade e consistência...' },
  { id: 'saving', label: 'Salvando histórico', message: 'Persistindo dossiê...' },
];

// ============================================================
// Classification function
// ============================================================
async function classifyCompany(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  searchResults: SearchResult[],
  cnpjData: BrasilAPICnpjData | null,
  emit: (event: string, data: Record<string, unknown>) => void,
): Promise<{ sector: string; subSector: string; companyType: string; scale: string; complexity: string }> {
  const contextSnippets = searchResults.slice(0, 15).map((r) => `${r.title}: ${r.snippet}`).join('\n');
  const cnpjContext = cnpjData
    ? `\nDADOS CNPJ: Razão Social: ${cnpjData.razao_social}, CNAE: ${cnpjData.cnae_fiscal_descricao || 'N/A'}, Porte: ${cnpjData.porte_descricao || 'N/A'}, UF: ${cnpjData.uf || 'N/A'}`
    : '';

  const result = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: `Você é um classificador de empresas brasileiras para fins comerciais/ERP.
Com base nas evidências abaixo, classifique a empresa "${companyName}":
1. sector: Um de: agro, construction, retail, industry, services, logistics
2. subSector: Para agro, um de: produtor_larga_escala, cooperativa, revenda_insumos, cerealista, trading, agroindustria, pecuaria, usina, regenerativa, mista. Para outros setores, descreva em snake_case
3. companyType: tipo da empresa
4. scale: "micro" | "pequena" | "media" | "grande" | "muito_grande" | "indefinido_sem_evidencia"
5. complexity: "baixa" | "media" | "alta" | "muito_alta" | "indefinido_sem_evidencia"
REGRAS: Se não houver evidência para porte, use "indefinido_sem_evidencia". Um "grupo" com múltiplas atividades provavelmente é "mista".${cnpjContext}
EVIDÊNCIAS:
${contextSnippets}
Responda APENAS com JSON válido, sem markdown:` },
      { role: 'user', content: `Classifique a empresa ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });
  const raw = result.choices?.[0]?.message?.content?.trim() || '{}';
  const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(jsonStr);
    // Normalize common LLM typos in subSector
    if (parsed.subSector === 'mistura' || parsed.subSector === 'mistos') parsed.subSector = 'mista';
    if (parsed.subSector === 'agro_industria' || parsed.subSector === 'agro-industria') parsed.subSector = 'agroindustria';
    emit('evidence_found', { message: `Setor: ${parsed.sector || '?'}, Subtipo: ${parsed.subSector || '?'}, Porte: ${parsed.scale || '?'}`, confidence: parsed.scale === 'indefinido_sem_evidencia' ? 0.3 : 0.8 });
    return parsed;
  } catch {
    return { sector: 'services', subSector: 'indefinido', companyType: 'indefinido', scale: 'indefinido_sem_evidencia', complexity: 'indefinido_sem_evidencia' };
  }
}

// ============================================================
// Evidence extraction
// ============================================================
async function extractEvidence(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  searchResults: SearchResult[],
  classification: Record<string, string>,
  emit: (event: string, data: Record<string, unknown>) => void,
): Promise<ExtractedFact[]> {
  const contextSnippets = searchResults.slice(0, 20).map((r, i) => `[${i + 1}] ${r.title}: ${r.snippet} (${r.url})`).join('\n');
  const result = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: `Você é um analista de inteligência comercial. Extraia FATOS, HIPÓTESES e LACUNAS sobre a empresa "${companyName}" (classificada como ${classification.sector} / ${classification.subSector}).
TIPOS: fact (fonte clara), hypothesis (inferência), recommendation (ação sugerida), gap (dado NÃO encontrado)
REGRAS ESTRITAS: NÃO invente dados. Se não encontrou, marque como gap. NÃO use frases genéricas. Confidence: high/medium/low. Um "fact" só é fact se a fonte afirma diretamente.
EVIDÊNCIAS COLETADAS:
${contextSnippets}
Responda APENAS com JSON array, sem markdown:` },
      { role: 'user', content: `Extraia evidências sobre ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });
  const raw = result.choices?.[0]?.message?.content?.trim() || '[]';
  const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(jsonStr);
    const facts = parsed.filter((e: { type: string }) => e.type === 'fact').length;
    const gaps = parsed.filter((e: { type: string }) => e.type === 'gap').length;
    emit('evidence_found', { message: `${facts} fatos, ${gaps} lacunas identificadas`, confidence: facts > 3 ? 0.7 : 0.4 });
    return parsed;
  } catch {
    return [{ type: 'gap', claim: 'Não foi possível extrair evidências estruturadas', source: 'sistema', confidence: 'low' }];
  }
}

// ============================================================
// Competitive search — REAL search
// ============================================================
async function searchCompetition(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  sector: string,
  emit: (event: string, data: Record<string, unknown>) => void,
): Promise<SearchResult[]> {
  const queries = [
    `${companyName} concorrentes mercado ${sector} Brasil`,
    `${companyName} competição setor ${sector}`,
  ];

  const results: SearchResult[] = [];
  for (const q of queries) {
    try {
      emit('source_checked', { source: 'web_search_competition', severity: 'consulting', message: 'Buscando sinais competitivos...' });
      const searchResponse = await zai.functions.invoke('web_search', { query: q, num: 5 });
      let parsed: Array<{ title?: string; url?: string; snippet?: string }> = [];
      if (Array.isArray(searchResponse)) {
        parsed = searchResponse;
      } else if (searchResponse && typeof searchResponse === 'object') {
        const resp = searchResponse as Record<string, unknown>;
        parsed = (resp.results || resp.items || []) as Array<{ title?: string; url?: string; snippet?: string }>;
      }
      for (const r of parsed) {
        if (r.url) results.push({ title: r.title || '', url: r.url, snippet: r.snippet || '', query: q });
      }
      emit('source_checked', { source: 'web_search_competition', severity: 'ok', message: `+${parsed.length} resultados competitivos` });
    } catch {
      emit('source_checked', { source: 'web_search_competition', severity: 'warning', message: 'Busca competitiva falhou, continuando...' });
    }
  }

  if (results.length > 0) {
    emit('evidence_found', { message: `${results.length} resultados sobre concorrência`, confidence: 0.5 });
  } else {
    emit('evidence_found', { message: 'Nenhum dado competitivo encontrado', confidence: 0.2 });
  }

  return results;
}

// ============================================================
// PORTA Score generation
// ============================================================
async function generatePortaScore(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  classification: Record<string, string>,
  evidences: ExtractedFact[],
  searchResults: SearchResult[],
  emit: (event: string, data: Record<string, unknown>) => void,
): Promise<{
  porte: number; operacao: number; retorno: number; tecnologia: number; adocao: number;
  total: number; notes: Record<string, { score: number; justification: string; evidences: string[]; confidence: string; gaps: string[]; penalty: number }>;
} | null> {
  const evidenceText = evidences.filter(e => e.type === 'fact' || e.type === 'hypothesis').map(e => `[${e.type.toUpperCase()} conf=${e.confidence}] ${e.claim} (fonte: ${e.source})`).join('\n');
  const gapText = evidences.filter(e => e.type === 'gap').map(e => e.claim).join('\n');

  // If there are no facts at all, don't calculate PORTA
  const facts = evidences.filter(e => e.type === 'fact');
  if (facts.length === 0) {
    emit('evidence_found', { message: 'Score PORTA não calculado: sem fatos com evidência', confidence: 0 });
    return null;
  }

  const result = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: `Você é um analista de score PORTA para soluções Senior. Calcule o score para "${companyName}" (${classification.sector} / ${classification.subSector}).
SCORE PORTA: P(Porte)=0.10, O(Operação)=0.25, R(Retorno)=0.10, T(Tecnologia)=0.30, A(Adoção)=0.25
REGRAS ESTRITAS:
- Cada nota DEVE ter JUSTIFICATIVA baseada em EVIDÊNCIA.
- Sem evidência = nota baixa (1-3) com confiança "low".
- NÃO dê nota "parece razoável" — use evidências concretas.
- Se há muitas lacunas, penalize.
- Confiança por dimensão: "high" (2+ fatos diretos), "medium" (1 fato + hipótese), "low" (só hipótese/gap).
EVIDÊNCIAS: ${evidenceText}
LACUNAS: ${gapText}
Setor: ${classification.sector}, Subtipo: ${classification.subSector}, Porte: ${classification.scale}, Complexidade: ${classification.complexity}
Responda APENAS com JSON válido, sem markdown:
{ "porte": 0-10, "operacao": 0-10, "retorno": 0-10, "tecnologia": 0-10, "adocao": 0-10, "notes": { "porte": { "score": X, "justification": "...", "evidences": ["..."], "confidence": "high|medium|low", "gaps": ["..."], "penalty": 0 }, ... } }` },
      { role: 'user', content: `Calcule o Score PORTA para ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });
  const raw = result.choices?.[0]?.message?.content?.trim() || '{}';
  let jsonStrPorta = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  // Robust JSON extraction: if direct parse fails, find the outermost JSON object
  try {
    JSON.parse(jsonStrPorta);
  } catch {
    const jsonMatch = jsonStrPorta.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStrPorta = jsonMatch[0];
  }
  try {
    const parsed = JSON.parse(jsonStrPorta);
    const porte = Math.min(10, Math.max(0, Number(parsed.porte) || 0));
    const operacao = Math.min(10, Math.max(0, Number(parsed.operacao) || 0));
    const retorno = Math.min(10, Math.max(0, Number(parsed.retorno) || 0));
    const tecnologia = Math.min(10, Math.max(0, Number(parsed.tecnologia) || 0));
    const adocao = Math.min(10, Math.max(0, Number(parsed.adocao) || 0));
    const total = Math.round((porte * 0.10 + operacao * 0.25 + retorno * 0.10 + tecnologia * 0.30 + adocao * 0.25) * 100) / 100;

    const dims = { porte, operacao, retorno, tecnologia, adocao };
    for (const [key, value] of Object.entries(dims)) {
      const dimConf = parsed.notes?.[key]?.confidence || 'low';
      emit('evidence_found', { message: `${key.toUpperCase()}: ${value.toFixed(1)} (confiança: ${dimConf})`, confidence: dimConf === 'high' ? 0.8 : dimConf === 'medium' ? 0.5 : 0.2 });
    }

    return { porte, operacao, retorno, tecnologia, adocao, total, notes: parsed.notes || {} };
  } catch {
    emit('evidence_found', { message: 'Score PORTA não pôde ser calculado — erro no parsing', confidence: 0 });
    return null;
  }
}

// ============================================================
// Summary generation
// ============================================================
async function generateSummary(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  classification: Record<string, string>,
  evidences: ExtractedFact[],
): Promise<string> {
  const facts = evidences.filter(e => e.type === 'fact').map(e => e.claim).join('; ');
  const hypotheses = evidences.filter(e => e.type === 'hypothesis').map(e => `[HIPÓTESE] ${e.claim}`).join('; ');
  const gaps = evidences.filter(e => e.type === 'gap').map(e => `[LACUNA] ${e.claim}`).join('; ');
  const result = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: `Você é um analista de inteligência comercial da Senior Sistemas. Escreva um resumo executivo BASEADO EM FATOS sobre "${companyName}".
CLASSIFICAÇÃO: ${classification.sector} / ${classification.subSector}, TIPO: ${classification.companyType}, PORTE: ${classification.scale}, COMPLEXIDADE: ${classification.complexity}
FATOS: ${facts}
HIPÓTESES: ${hypotheses}
LACUNAS: ${gaps}
REGRAS: BASEADO NOS FATOS. NÃO use frases genéricas. Hipótese = "Parece que...". Lacuna = "Não foi possível verificar...". Seja ESPECÍFICO. NÃO estime sem evidência. Se não houver fatos suficientes, diga claramente.
Escreva em 3-5 parágrafos objetivos.` },
      { role: 'user', content: `Escreva o resumo executivo sobre ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });
  return result.choices?.[0]?.message?.content || 'Resumo não disponível — evidências insuficientes.';
}

// ============================================================
// Commercial thesis
// ============================================================
async function generateCommercialThesis(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  classification: Record<string, string>,
  evidences: ExtractedFact[],
  subSector: string,
): Promise<Record<string, unknown>> {
  const playbook = AGRO_SUB_PLAYBOOKS[subSector] || AGRO_SUB_PLAYBOOKS.mista;
  const facts = evidences.filter(e => e.type === 'fact').map(e => e.claim).join('; ');
  const gaps = evidences.filter(e => e.type === 'gap').map(e => e.claim).join('; ');
  const result = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: `Você é um consultor comercial da Senior Sistemas. Gere uma tese comercial para "${companyName}".
CLASSIFICAÇÃO: ${classification.sector} / ${subSector} (${playbook.label})
MÓDULOS SENIOR: ${playbook.seniorModules.join(', ')}
DORES TÍPICAS: ${playbook.painPoints.join(', ')}
FATOS: ${facts}
LACUNAS: ${gaps}
REGRAS: Só afirme o que tem evidência. Marque hipóteses como "Parece que...". Se não houver fatos sobre algo, não invente.
Gere JSON: { "thesis": "...", "seniorModules": [...], "painPoints": [...], "decisionMakers": [...], "risks": [...], "nextSteps": [...], "smartQuestions": [...] }` },
      { role: 'user', content: `Gere tese comercial para ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });
  const raw = result.choices?.[0]?.message?.content?.trim() || '{}';
  const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(jsonStr); } catch {
    return { thesis: 'Tese não disponível por falta de evidências suficientes.', seniorModules: [], painPoints: [], decisionMakers: [], risks: [], nextSteps: [], smartQuestions: [] };
  }
}

// ============================================================
// Quality check
// ============================================================
async function qualityCheck(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  summary: string,
  evidences: ExtractedFact[],
  classification: Record<string, string>,
): Promise<{ passed: boolean; issues: string[]; rewrittenSummary?: string }> {
  const issues: string[] = [];
  const lowerSummary = summary.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lowerSummary.includes(phrase.toLowerCase())) issues.push(`Frase genérica: "${phrase}"`);
  }
  const facts = evidences.filter(e => e.type === 'fact');
  const gaps = evidences.filter(e => e.type === 'gap');
  if (facts.length === 0 && gaps.length > 3) issues.push('Muitas lacunas e nenhum fato');
  if (classification.scale === 'indefinido_sem_evidencia' && (lowerSummary.includes('grande') || lowerSummary.includes('médio') || lowerSummary.includes('pequeno'))) {
    issues.push('Resumo afirma porte sem evidência');
  }
  if (issues.length === 0) return { passed: true, issues: [] };
  const rewriteResult = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: `Reescreva REMOVENDO: ${issues.join('\n')}. Substitua afirmações sem evidência por "Não foi possível verificar...". RESUMO ORIGINAL: ${summary}` },
      { role: 'user', content: 'Reescreva' },
    ],
    thinking: { type: 'disabled' },
  });
  return { passed: false, issues, rewrittenSummary: rewriteResult.choices?.[0]?.message?.content || summary };
}

// ============================================================
// POST /api/scout/investigate — SSE Streaming Pipeline
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyName, cnpj } = body as { companyName: string; cnpj?: string };

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'companyName is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const trimmedName = companyName.trim();

    // Create investigation as "investigating" — this is the ONLY initial status
    const investigation = await db.scoutInvestigation.create({
      data: { companyName: trimmedName, cnpj: cnpj?.trim() || null, status: 'investigating' },
    });

    // SSE stream
    const encoder = new TextEncoder();
    let closed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: Record<string, unknown>) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(sseEvent(event, { ...data, timestamp: new Date().toISOString() })));
          } catch {
            closed = true;
          }
        };

        const sendStageStart = (stageId: string) => {
          const stage = PIPELINE_STAGES.find(s => s.id === stageId);
          send('progress_stage_started', { stageId, label: stage?.label || stageId, message: stage?.message || '' });
        };

        const sendStageComplete = (stageId: string) => {
          const stage = PIPELINE_STAGES.find(s => s.id === stageId);
          send('progress_stage_completed', { stageId, label: stage?.label || stageId });
        };

        const sendStageWarning = (stageId: string, message: string) => {
          send('progress_stage_warning', { stageId, message });
        };

        const markInvestigationFailed = async (reason: string) => {
          // CRITICAL: Mark as FAILED, never as completed
          try {
            await db.scoutInvestigation.update({
              where: { id: investigation.id },
              data: {
                status: 'failed',
                rawData: JSON.stringify({ error: reason, failedAt: new Date().toISOString() }),
              },
            });
          } catch (dbError) {
            console.error('[Scout] Failed to mark investigation as failed:', dbError);
          }
        };

        try {
          const zai = await ZAI.create();

          // ====== STAGE 1: PREPARING ======
          sendStageStart('preparing');
          send('evidence_found', { message: `Empresa identificada: ${trimmedName}${cnpj ? `, CNPJ: ${cnpj}` : ''}`, confidence: 0.9 });
          sendStageComplete('preparing');

          // ====== STAGE 2: CADASTRE (Real BrasilAPI + Web Search) ======
          sendStageStart('cadastre');

          // Execute the research engine — this does real BrasilAPI + web search with retry
          const researchResult = await executeResearch(
            trimmedName,
            cnpj?.trim() || undefined,
            undefined,
            (event, data) => send(event, data),
          );

          // If research itself failed (no results at all), this is a CRITICAL failure
          if (researchResult.status === 'failed') {
            send('progress_stage_failed', { stageId: 'cadastre', message: researchResult.error?.message || 'Pesquisa falhou' });
            await markInvestigationFailed(researchResult.error?.message || 'Pesquisa falhou');
            send('final_response_ready', {
              metadata: {
                error: true,
                message: researchResult.error?.message || 'Não consegui encontrar fontes confiáveis.',
                investigationId: investigation.id,
              },
            });
            return; // EXIT — do not continue pipeline
          }

          if (researchResult.status === 'cancelled') {
            await markInvestigationFailed('Investigação cancelada pelo usuário');
            send('final_response_ready', {
              metadata: { error: true, message: 'Investigação cancelada.', investigationId: investigation.id },
            });
            return;
          }

          // Use results from research engine
          const searchResults = researchResult.searchResults;
          const cnpjData = researchResult.cnpjData;

          if (searchResults.length === 0) {
            send('progress_stage_failed', { stageId: 'cadastre', message: 'Nenhum resultado encontrado em nenhuma fonte' });
            await markInvestigationFailed('Nenhum resultado encontrado em nenhuma fonte. Tente informar o CNPJ, site oficial ou um termo mais específico.');
            send('final_response_ready', {
              metadata: {
                error: true,
                message: 'Não consegui obter fontes confiáveis suficientes. Tente informar o CNPJ, site oficial ou um nome mais específico.',
                investigationId: investigation.id,
              },
            });
            return; // EXIT — do not continue pipeline
          }

          sendStageComplete('cadastre');
          sendStageComplete('enriching'); // Enriching was done by the research engine

          // ====== STAGE 3: SECTOR DETECTION ======
          sendStageStart('sector_detection');
          const classification = await classifyCompany(zai, trimmedName, searchResults, cnpjData, send);
          send('evidence_found', { message: `Setor: ${classification.sector}, Subtipo: ${classification.subSector}, Porte: ${classification.scale}`, confidence: classification.scale === 'indefinido_sem_evidencia' ? 0.3 : 0.8 });
          sendStageComplete('sector_detection');

          // ====== STAGE 4: PLAYBOOK ======
          sendStageStart('playbook');
          const playbook = AGRO_SUB_PLAYBOOKS[classification.subSector || 'mista'];
          if (playbook) {
            send('evidence_found', { message: `Playbook: ${playbook.label} — ${playbook.seniorModules.length} módulos Senior relevantes`, confidence: 0.9 });
          }
          sendStageComplete('playbook');

          // ====== STAGE 5: EVIDENCE EXTRACTION ======
          sendStageStart('evidence');
          const evidenceList = await extractEvidence(zai, trimmedName, searchResults, classification, send);
          const facts = evidenceList.filter(e => e.type === 'fact');
          const gaps = evidenceList.filter(e => e.type === 'gap');
          send('confidence_updated', { confidence: facts.length > 5 ? 0.7 : facts.length > 2 ? 0.5 : 0.3 });
          sendStageComplete('evidence');

          // ====== EVIDENCE GATE: Check minimum evidence ======
          const evidenceGate = evaluateEvidence(evidenceList);
          if (evidenceGate.recommendation === 'no_evidence') {
            send('progress_stage_failed', { stageId: 'evidence', message: evidenceGate.message });
            await markInvestigationFailed(evidenceGate.message);
            send('final_response_ready', {
              metadata: {
                error: true,
                message: evidenceGate.message,
                investigationId: investigation.id,
              },
            });
            return; // EXIT — no facts, no analysis
          }

          if (evidenceGate.recommendation === 'insufficient_evidence') {
            sendStageWarning('evidence', evidenceGate.message);
            // Continue but the summary will reflect this
          }

          // ====== STAGE 6: COMPETITION (Real search) ======
          sendStageStart('competition');
          const competitionResults = await searchCompetition(zai, trimmedName, classification.sector, send);
          // Merge competition results into search results for PORTA scoring
          const allSearchResults = [...searchResults, ...competitionResults];
          sendStageComplete('competition');

          // ====== STAGE 7: PORTA SCORE ======
          sendStageStart('porta');
          const portaResult = await generatePortaScore(zai, trimmedName, classification, evidenceList, allSearchResults, send);

          if (portaResult) {
            send('evidence_found', { message: `Score PORTA: ${portaResult.total.toFixed(1)}/10`, confidence: portaResult.total > 5 ? 0.7 : 0.4 });
          } else {
            send('evidence_found', { message: 'Score PORTA: não calculado por falta de evidência', confidence: 0 });
          }
          sendStageComplete('porta');

          // ====== STAGE 8: THESIS ======
          sendStageStart('thesis');
          let summary = await generateSummary(zai, trimmedName, classification, evidenceList);
          const commercialThesis = await generateCommercialThesis(zai, trimmedName, classification, evidenceList, classification.subSector || 'mista');
          sendStageComplete('thesis');

          // ====== STAGE 9: QUALITY VALIDATION ======
          sendStageStart('validating');
          const qc = await qualityCheck(zai, summary, evidenceList, classification);
          if (!qc.passed && qc.rewrittenSummary) {
            summary = qc.rewrittenSummary;
            sendStageWarning('validating', `Verificação de qualidade: reescrita aplicada (${qc.issues.length} problemas)`);
          }
          sendStageComplete('validating');

          // ====== STAGE 10: SAVE ======
          sendStageStart('saving');

          // CRITICAL: Only save as "completed" if we reached this point
          // (meaning all critical stages succeeded and evidence gate passed)
          const updatedInvestigation = await db.scoutInvestigation.update({
            where: { id: investigation.id },
            data: {
              status: 'completed', // ONLY set to completed here, after all validation
              summary,
              sector: classification.sector || null,
              subSector: classification.subSector || null,
              rawData: JSON.stringify({
                searches: allSearchResults.length,
                results: allSearchResults.slice(0, 30),
                cnpjData: cnpjData || null,
                searchedAt: new Date().toISOString(),
                evidenceGate: {
                  hasMinimumEvidence: evidenceGate.hasMinimumEvidence,
                  factCount: evidenceGate.factCount,
                  highConfidenceFactCount: evidenceGate.highConfidenceFactCount,
                  recommendation: evidenceGate.recommendation,
                },
              }),
              evidences: JSON.stringify(evidenceList),
              classification: JSON.stringify(classification),
              commercialThesis: JSON.stringify(commercialThesis),
              sources: JSON.stringify(allSearchResults.slice(0, 20).map((r) => ({
                title: r.title, url: r.url, snippet: r.snippet, type: 'web_search', query: r.query,
              }))),
              qualityCheck: JSON.stringify(qc),
            },
          });

          // Only create PORTA score if it was actually calculated with evidence
          let portaScore: { id: string; investigationId: string; porte: number; operacao: number; retorno: number; tecnologia: number; adocao: number; total: number; sector: string | null; subSector: string | null; notes: string | null; createdAt: Date; updatedAt: Date } | null = null;
          if (portaResult) {
            portaScore = await db.portaScore.create({
              data: {
                investigationId: investigation.id,
                porte: portaResult.porte, operacao: portaResult.operacao, retorno: portaResult.retorno,
                tecnologia: portaResult.tecnologia, adocao: portaResult.adocao, total: portaResult.total,
                sector: classification.sector || null, subSector: classification.subSector || null,
                notes: JSON.stringify(portaResult.notes),
              },
            });
          }

          sendStageComplete('saving');

          // ====== FINAL: SUCCESS ======
          send('final_response_ready', {
            metadata: {
              investigation: updatedInvestigation,
              portaScore,
              evidenceGate: {
                hasMinimumEvidence: evidenceGate.hasMinimumEvidence,
                factCount: evidenceGate.factCount,
                recommendation: evidenceGate.recommendation,
              },
            },
          });

        } catch (analysisError) {
          console.error('[Scout SSE] Pipeline error:', analysisError);

          // CRITICAL: Mark as FAILED
          const errorMsg = analysisError instanceof Error ? analysisError.message : 'Erro desconhecido';
          send('progress_stage_failed', { stageId: 'pipeline', message: errorMsg });
          await markInvestigationFailed(errorMsg);

          send('final_response_ready', {
            metadata: {
              error: true,
              message: `Investigação falhou: ${errorMsg}`,
              investigationId: investigation.id,
            },
          });
        } finally {
          try { controller.close(); } catch { /* already closed */ }
          closed = true;
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Scout] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
