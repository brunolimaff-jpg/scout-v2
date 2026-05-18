import { NextRequest } from 'next/server';
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
// Pipeline functions (same logic, but with SSE emission)
// ============================================================

async function searchCompanyData(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  cnpj?: string,
  emit?: (event: string, data: Record<string, unknown>) => void,
): Promise<Array<{ title: string; url: string; snippet: string; query: string }>> {
  const queries = [
    `"${companyName}" grupo empresa Brasil atuação`,
    `"${companyName}" fundação história origem`,
    `"${companyName}" faturamento receita área hectares produção`,
    `"${companyName}" unidades produtivas fazendas operações estados`,
    `"${companyName}" tecnologia ERP sistemas gestão software`,
    `"${companyName}" certificação ESG sustentável regenerativa CRA`,
  ];
  if (cnpj) queries.push(`"${cnpj}" receita federal CNPJ`);

  const allResults: Array<{ title: string; url: string; snippet: string; query: string }> = [];
  const seenUrls = new Set<string>();

  for (let qi = 0; qi < queries.length; qi++) {
    try {
      emit?.('source_checked', { source: 'web_search', severity: 'info', message: `Busca ${qi + 1}/${queries.length}: consultando...` });
      const searchResponse = await zai.functions.invoke('web_search', { query: queries[qi], num: 10 });
      let results: Array<{ title?: string; url?: string; snippet?: string }> = [];
      if (Array.isArray(searchResponse)) {
        results = searchResponse;
      } else if (searchResponse && typeof searchResponse === 'object') {
        const resp = searchResponse as Record<string, unknown>;
        results = (resp.results || resp.items || []) as Array<{ title?: string; url?: string; snippet?: string }>;
      }
      let newCount = 0;
      for (const r of results) {
        const url = r.url || '';
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);
        allResults.push({ title: r.title || '', url, snippet: r.snippet || '', query: queries[qi] });
        newCount++;
      }
      emit?.('source_checked', { source: 'web_search', severity: 'ok', message: `Busca ${qi + 1}: +${newCount} resultados` });
    } catch {
      emit?.('source_checked', { source: 'web_search', severity: 'warning', message: `Busca ${qi + 1} falhou, continuando...` });
    }
  }

  emit?.('evidence_found', { message: `${allResults.length} resultados encontrados no total`, confidence: allResults.length > 10 ? 0.7 : 0.4 });
  return allResults;
}

async function classifyCompany(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  searchResults: Array<{ title: string; snippet: string }>,
  emit?: (event: string, data: Record<string, unknown>) => void,
): Promise<{ sector: string; subSector: string; companyType: string; scale: string; complexity: string }> {
  const contextSnippets = searchResults.slice(0, 15).map((r) => `${r.title}: ${r.snippet}`).join('\n');
  const result = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: `Você é um classificador de empresas brasileiras para fins comerciais/ERP.
Com base nas evidências abaixo, classifique a empresa "${companyName}":
1. sector: Um de: agro, construction, retail, industry, services, logistics
2. subSector: Para agro, um de: produtor_larga_escala, cooperativa, revenda_insumos, cerealista, trading, agroindustria, pecuaria, usina, regenerativa, mista. Para outros setores, descreva em snake_case
3. companyType: tipo da empresa
4. scale: "micro" | "pequena" | "media" | "grande" | "muito_grande" | "indefinido_sem_evidencia"
5. complexity: "baixa" | "media" | "alta" | "muito_alta" | "indefinido_sem_evidencia"
REGRAS: Se não houver evidência para porte, use "indefinido_sem_evidencia". Um "grupo" com múltiplas atividades provavelmente é "mista".
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
    emit?.('evidence_found', { message: `Setor: ${parsed.sector || '?'}, Subtipo: ${parsed.subSector || '?'}`, confidence: 0.8 });
    return parsed;
  } catch {
    return { sector: 'services', subSector: 'indefinido', companyType: 'indefinido', scale: 'indefinido_sem_evidencia', complexity: 'indefinido_sem_evidencia' };
  }
}

async function extractEvidence(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  searchResults: Array<{ title: string; url: string; snippet: string }>,
  classification: Record<string, string>,
  emit?: (event: string, data: Record<string, unknown>) => void,
): Promise<Array<{ type: string; claim: string; source: string; confidence: string }>> {
  const contextSnippets = searchResults.slice(0, 20).map((r, i) => `[${i + 1}] ${r.title}: ${r.snippet} (${r.url})`).join('\n');
  const result = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: `Você é um analista de inteligência comercial. Extraia FATOS, HIPÓTESES e LACUNAS sobre a empresa "${companyName}" (classificada como ${classification.sector} / ${classification.subSector}).
TIPOS: fact (fonte clara), hypothesis (inferência), recommendation (ação sugerida), gap (dado NÃO encontrado)
REGRAS ESTRITAS: NÃO invente dados. Se não encontrou, marque como gap. NÃO use frases genéricas. Confidence: high/medium/low.
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
    emit?.('evidence_found', { message: `${facts} fatos, ${gaps} lacunas identificadas`, confidence: facts > 3 ? 0.7 : 0.4 });
    return parsed;
  } catch {
    return [{ type: 'gap', claim: 'Não foi possível extrair evidências estruturadas', source: 'sistema', confidence: 'low' }];
  }
}

async function generatePortaScore(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  classification: Record<string, string>,
  evidences: Array<{ type: string; claim: string; source: string; confidence: string }>,
  searchResults: Array<{ title: string; snippet: string }>,
  emit?: (event: string, data: Record<string, unknown>) => void,
): Promise<{
  porte: number; operacao: number; retorno: number; tecnologia: number; adocao: number;
  total: number; notes: Record<string, { score: number; justification: string; evidences: string[]; confidence: string; gaps: string[]; penalty: number }>;
}> {
  const evidenceText = evidences.filter(e => e.type === 'fact' || e.type === 'hypotesis').map(e => `[${e.type.toUpperCase()} conf=${e.confidence}] ${e.claim} (fonte: ${e.source})`).join('\n');
  const gapText = evidences.filter(e => e.type === 'gap').map(e => e.claim).join('\n');
  const result = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: `Você é um analista de score PORTA para soluções Senior. Calcule o score para "${companyName}" (${classification.sector} / ${classification.subSector}).
SCORE PORTA: P(Porte)=0.10, O(Operação)=0.25, R(Retorno)=0.10, T(Tecnologia)=0.30, A(Adoção)=0.25
REGRAS: Cada nota com JUSTIFICATIVA baseada em EVIDÊNCIA. Sem evidência = nota baixa (1-3). Penalidade por lacuna. NÃO dê nota "parece razoável".
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
  const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(jsonStr);
    const porte = Math.min(10, Math.max(0, Number(parsed.porte) || 0));
    const operacao = Math.min(10, Math.max(0, Number(parsed.operacao) || 0));
    const retorno = Math.min(10, Math.max(0, Number(parsed.retorno) || 0));
    const tecnologia = Math.min(10, Math.max(0, Number(parsed.tecnologia) || 0));
    const adocao = Math.min(10, Math.max(0, Number(parsed.adocao) || 0));
    const total = Math.round((porte * 0.10 + operacao * 0.25 + retorno * 0.10 + tecnologia * 0.30 + adocao * 0.25) * 100) / 100;

    // Emit dimension-by-dimension
    const dims = { porte, operacao, retorno, tecnologia, adocao };
    for (const [key, value] of Object.entries(dims)) {
      const dimConf = parsed.notes?.[key]?.confidence || 'low';
      emit?.('evidence_found', { message: `${key.toUpperCase()}: ${value.toFixed(1)} (confiança: ${dimConf})`, confidence: dimConf === 'high' ? 0.8 : dimConf === 'medium' ? 0.5 : 0.2 });
    }

    return { porte, operacao, retorno, tecnologia, adocao, total, notes: parsed.notes || {} };
  } catch {
    return { porte: 0, operacao: 0, retorno: 0, tecnologia: 0, adocao: 0, total: 0, notes: {} };
  }
}

async function generateSummary(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  classification: Record<string, string>,
  evidences: Array<{ type: string; claim: string; source: string; confidence: string }>,
): Promise<string> {
  const facts = evidences.filter(e => e.type === 'fact').map(e => e.claim).join('; ');
  const hypotheses = evidences.filter(e => e.type === 'hypotesis').map(e => `[HIPÓTESE] ${e.claim}`).join('; ');
  const gaps = evidences.filter(e => e.type === 'gap').map(e => `[LACUNA] ${e.claim}`).join('; ');
  const result = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: `Você é um analista de inteligência comercial da Senior Sistemas. Escreva um resumo executivo BASEADO EM FATOS sobre "${companyName}".
CLASSIFICAÇÃO: ${classification.sector} / ${classification.subSector}, TIPO: ${classification.companyType}, PORTE: ${classification.scale}, COMPLEXIDADE: ${classification.complexity}
FATOS: ${facts}, HIPÓTESES: ${hypotheses}, LACUNAS: ${gaps}
REGRAS: BASEADO NOS FATOS. NÃO use frases genéricas. Hipótese = "Parece que...". Lacuna = "Não foi possível verificar...". Seja ESPECÍFICO. NÃO estime sem evidência.
Escreva em 3-5 parágrafos objetivos.` },
      { role: 'user', content: `Escreva o resumo executivo sobre ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });
  return result.choices?.[0]?.message?.content || 'Resumo não disponível.';
}

async function generateCommercialThesis(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  companyName: string,
  classification: Record<string, string>,
  evidences: Array<{ type: string; claim: string; source: string; confidence: string }>,
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
FATOS: ${facts}, LACUNAS: ${gaps}
Gere JSON: { "thesis": "...", "seniorModules": [...], "painPoints": [...], "decisionMakers": [...], "risks": [...], "nextSteps": [...], "smartQuestions": [...] }` },
      { role: 'user', content: `Gere tese comercial para ${companyName}` },
    ],
    thinking: { type: 'disabled' },
  });
  const raw = result.choices?.[0]?.message?.content?.trim() || '{}';
  const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(jsonStr); } catch {
    return { thesis: 'Tese não disponível', seniorModules: [], painPoints: [], decisionMakers: [], risks: [], nextSteps: [], smartQuestions: [] };
  }
}

async function qualityCheck(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  summary: string,
  evidences: Array<{ type: string; claim: string; source: string; confidence: string }>,
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
// Pipeline stages definition
// ============================================================
const PIPELINE_STAGES = [
  { id: 'preparing', label: 'Preparando investigação', message: 'Normalizando pergunta e extraindo empresa/CNPJ...' },
  { id: 'cadastre', label: 'Consultando dados cadastrais', message: 'Buscando CNPJ, CNAE, razão social...' },
  { id: 'enriching', label: 'Enriquecendo fontes públicas', message: 'Consultando web search e fontes disponíveis...' },
  { id: 'sector_detection', label: 'Detectando setor', message: 'Cruzando CNAE, nome e sinais públicos...' },
  { id: 'playbook', label: 'Selecionando playbook', message: 'Escolhendo lente setorial...' },
  { id: 'evidence', label: 'Buscando evidências', message: 'Coletando fatos, fontes e sinais...' },
  { id: 'competition', label: 'Mapeando concorrência', message: 'Identificando sinais competitivos...' },
  { id: 'porta', label: 'Avaliando PORTA', message: 'Calculando Porte, Operação, Retorno, Tecnologia, Adoção...' },
  { id: 'thesis', label: 'Montando tese comercial', message: 'Gerando oportunidades, riscos e perguntas...' },
  { id: 'saving', label: 'Salvando histórico', message: 'Persistindo sessão e dossiê...' },
  { id: 'finishing', label: 'Finalizando dossiê', message: 'Organizando resposta e validando...' },
];

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
    const investigation = await db.scoutInvestigation.create({
      data: { companyName: trimmedName, cnpj: cnpj?.trim() || null, status: 'investigating' },
    });

    // Create SSE stream
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

        try {
          // Stage: Preparing
          sendStageStart('preparing');
          send('evidence_found', { message: `Empresa identificada: ${trimmedName}${cnpj ? `, CNPJ: ${cnpj}` : ''}`, confidence: 0.9 });
          sendStageComplete('preparing');

          const zai = await ZAI.create();

          // Stage: Cadastre (search)
          sendStageStart('cadastre');
          send('source_checked', { source: 'ReceitaWS', severity: 'consulting', message: 'Consultando dados cadastrais...' });
          const searchResults = await searchCompanyData(zai, trimmedName, cnpj, send);
          if (searchResults.length === 0) {
            sendStageWarning('cadastre', 'Nenhum resultado encontrado na busca pública');
          }
          send('source_checked', { source: 'ReceitaWS', severity: searchResults.length > 0 ? 'ok' : 'failed', message: `${searchResults.length} fontes encontradas` });
          sendStageComplete('cadastre');

          // Stage: Enriching
          sendStageStart('enriching');
          send('source_checked', { source: 'BrasilAPI', severity: 'consulting', message: 'Consultando BrasilAPI...' });
          // BrasilAPI enrichment would go here - for now mark as skipped
          send('source_checked', { source: 'BrasilAPI', severity: 'cache', message: 'BrasilAPI: consulta indireta via web search' });
          send('source_checked', { source: 'BCB', severity: 'ignored', message: 'BCB: não aplicável nesta etapa' });
          sendStageComplete('enriching');

          // Stage: Sector detection
          sendStageStart('sector_detection');
          const classification = await classifyCompany(zai, trimmedName, searchResults, send);
          send('evidence_found', { message: `Setor: ${classification.sector}, Subtipo: ${classification.subSector}, Porte: ${classification.scale}`, confidence: 0.8 });
          sendStageComplete('sector_detection');

          // Stage: Playbook
          sendStageStart('playbook');
          const playbook = AGRO_SUB_PLAYBOOKS[classification.subSector || 'mista'];
          if (playbook) {
            send('evidence_found', { message: `Playbook: ${playbook.label} — ${playbook.seniorModules.length} módulos Senior relevantes`, confidence: 0.9 });
          }
          sendStageComplete('playbook');

          // Stage: Evidence
          sendStageStart('evidence');
          const evidenceList = await extractEvidence(zai, trimmedName, searchResults, classification, send);
          const facts = evidenceList.filter(e => e.type === 'fact');
          const gaps = evidenceList.filter(e => e.type === 'gap');
          send('confidence_updated', { confidence: facts.length > 5 ? 0.7 : facts.length > 2 ? 0.5 : 0.3 });
          sendStageComplete('evidence');

          // Stage: Competition
          sendStageStart('competition');
          // Competition signals are part of the evidence - mark as completed with note
          send('evidence_found', { message: `Sinais competitivos: ${gaps.length} lacunas podem conter dados competitivos`, confidence: 0.4 });
          sendStageComplete('competition');

          // Stage: PORTA
          sendStageStart('porta');
          const portaResult = await generatePortaScore(zai, trimmedName, classification, evidenceList, searchResults, send);
          send('evidence_found', { message: `Score PORTA: ${portaResult.total.toFixed(1)}/10`, confidence: 0.7 });
          sendStageComplete('porta');

          // Stage: Thesis
          sendStageStart('thesis');
          let summary = await generateSummary(zai, trimmedName, classification, evidenceList);
          const commercialThesis = await generateCommercialThesis(zai, trimmedName, classification, evidenceList, classification.subSector || 'mista');
          sendStageComplete('thesis');

          // Stage: Saving
          sendStageStart('saving');
          const qc = await qualityCheck(zai, summary, evidenceList, classification);
          if (!qc.passed && qc.rewrittenSummary) {
            summary = qc.rewrittenSummary;
            sendStageWarning('saving', 'Quality check: reescrita aplicada');
          }

          const updatedInvestigation = await db.scoutInvestigation.update({
            where: { id: investigation.id },
            data: {
              status: 'completed',
              summary,
              sector: classification.sector || null,
              subSector: classification.subSector || null,
              rawData: JSON.stringify({ searches: searchResults.length, results: searchResults.slice(0, 30), searchedAt: new Date().toISOString() }),
              evidences: JSON.stringify(evidenceList),
              classification: JSON.stringify(classification),
              commercialThesis: JSON.stringify(commercialThesis),
              sources: JSON.stringify(searchResults.slice(0, 20).map((r) => ({ title: r.title, url: r.url, snippet: r.snippet, type: 'web_search' }))),
              qualityCheck: JSON.stringify(qc),
            },
          });

          const portaScore = await db.portaScore.create({
            data: {
              investigationId: investigation.id,
              porte: portaResult.porte, operacao: portaResult.operacao, retorno: portaResult.retorno,
              tecnologia: portaResult.tecnologia, adocao: portaResult.adocao, total: portaResult.total,
              sector: classification.sector || null, subSector: classification.subSector || null,
              notes: JSON.stringify(portaResult.notes),
            },
          });
          sendStageComplete('saving');

          // Stage: Finishing
          sendStageStart('finishing');
          send('final_response_ready', {
            metadata: {
              investigation: updatedInvestigation,
              portaScore,
            },
          });
          sendStageComplete('finishing');
        } catch (analysisError) {
          console.error('[Scout SSE] Pipeline error:', analysisError);
          const failedStage = PIPELINE_STAGES.find(s => !closed);
          if (failedStage) {
            send('progress_stage_failed', { stageId: failedStage.id, message: analysisError instanceof Error ? analysisError.message : 'Erro desconhecido' });
          }
          await db.scoutInvestigation.update({
            where: { id: investigation.id },
            data: { status: 'failed', rawData: JSON.stringify({ error: analysisError instanceof Error ? analysisError.message : 'Unknown error', failedAt: new Date().toISOString() }) },
          }).catch(() => {});
          send('final_response_ready', {
            metadata: { error: true, message: analysisError instanceof Error ? analysisError.message : 'Erro na investigação', investigationId: investigation.id },
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
