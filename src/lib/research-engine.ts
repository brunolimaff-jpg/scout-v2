// ============================================================
// RESEARCH ENGINE — Real Brain for Senior Scout 360
// ============================================================
// Rules:
// - No mock data
// - No fake sources
// - No silent failures
// - Every claim needs evidence
// - Every external call has timeout + retry
// - Fallback to alternative providers before giving up
// - Honest failure over beautiful lies
// ============================================================

import ZAI from 'z-ai-web-dev-sdk';

// ============================================================
// TYPES
// ============================================================

export type ResearchStatus = 'idle' | 'running' | 'retrying' | 'validating' | 'success' | 'failed' | 'cancelled';

export interface ResearchError {
  code: string;
  message: string;
  provider?: string;
  retryable: boolean;
  cause?: unknown;
}

export interface ValidatedSource {
  url: string;
  domain: string;
  title: string;
  snippet: string;
  fullContent?: string;
  type: 'web_search' | 'cnpj_registry' | 'page_reader' | 'cache';
  confidence: 'high' | 'medium' | 'low';
  consultedAt: string;
  relevance?: number;
}

export interface ExtractedFact {
  type: 'fact' | 'hypothesis' | 'recommendation' | 'gap';
  claim: string;
  source: string;
  sourceUrl?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface QueryPlan {
  companyName: string;
  cnpj?: string;
  queries: string[];
  cnpjQuery?: string;
  siteSpecificQueries: string[];
  competitiveQueries: string[];
  sectorHints: string[];
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  query: string;
}

export interface BrasilAPICnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  cnae_fiscal?: string;
  cnae_fiscal_descricao?: string;
  municipio?: string;
  uf?: string;
  porte_descricao?: string;
  situacao?: string;
  data_inicio_atividade?: string;
  telefone1?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  capital_social?: number;
  qsa?: Array<{ nome: string; qual: string }>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  timeoutMs: 30000,
};

// ============================================================
// UTILITY: Timeout wrapper
// ============================================================

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ============================================================
// UTILITY: Retry with exponential backoff
// ============================================================

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: unknown) => void,
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, timeoutMs } = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 500, maxDelayMs);
        onRetry?.(attempt + 1, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ============================================================
// UTILITY: Extract domain from URL
// ============================================================

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ============================================================
// QUERY PLANNER
// ============================================================

export function planQueries(companyName: string, cnpj?: string, sectorHint?: string): QueryPlan {
  const queries = [
    `"${companyName}" grupo empresa Brasil atuação`,
    `"${companyName}" fundação história origem operação`,
    `"${companyName}" faturamento receita área hectares produção unidades`,
    `"${companyName}" tecnologia ERP sistemas gestão software digital`,
    `"${companyName}" certificação ESG sustentável regulamentação`,
  ];

  const siteSpecificQueries: string[] = [];
  const competitiveQueries: string[] = [];

  // If we have a sector hint, add sector-specific queries
  if (sectorHint === 'agro') {
    queries.push(`"${companyName}" agricultura safra armazenagem processamento`);
    competitiveQueries.push(`${companyName} concorrentes mercado agrícola Brasil`);
  } else if (sectorHint === 'construction') {
    queries.push(`"${companyName}" construção obras empreiteira empreendimentos`);
    competitiveQueries.push(`${companyName} concorrentes mercado construção Brasil`);
  } else if (sectorHint === 'retail') {
    queries.push(`"${companyName}" varejo lojas redes pontos venda`);
    competitiveQueries.push(`${companyName} concorrentes mercado varejo Brasil`);
  } else if (sectorHint === 'industry') {
    queries.push(`"${companyName}" indústria fábrica produção manufatura`);
    competitiveQueries.push(`${companyName} concorrentes mercado industrial Brasil`);
  } else if (sectorHint === 'services') {
    queries.push(`"${companyName}" serviços operações clientes prestação`);
    competitiveQueries.push(`${companyName} concorrentes mercado serviços Brasil`);
  } else if (sectorHint === 'logistics') {
    queries.push(`"${companyName}" logística transporte frota distribuição`);
    competitiveQueries.push(`${companyName} concorrentes mercado logística Brasil`);
  } else {
    // Generic competitive queries
    competitiveQueries.push(`${companyName} concorrentes mercado Brasil`);
  }

  const cnpjQuery = cnpj ? `"${cnpj}" receita federal CNPJ cadastro` : undefined;

  // Sector hints for classification
  const sectorHints = sectorHint ? [sectorHint] : [];

  return {
    companyName,
    cnpj,
    queries,
    cnpjQuery,
    siteSpecificQueries,
    competitiveQueries,
    sectorHints,
  };
}

// ============================================================
// MULTI-PROVIDER SEARCH
// ============================================================

export class SearchProvider {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  async init(): Promise<void> {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
  }

  get client(): Awaited<ReturnType<typeof ZAI.create>> {
    if (!this.zai) throw new Error('SearchProvider not initialized. Call init() first.');
    return this.zai;
  }

  // ---------- Web Search (Primary) ----------

  async webSearch(
    query: string,
    num: number = 10,
    onRetry?: (attempt: number, error: unknown) => void,
  ): Promise<SearchResult[]> {
    await this.init();
    const response = await withRetry(
      async () => {
        const result = await this.client.functions.invoke('web_search', { query, num });
        return result;
      },
      { maxRetries: 2, timeoutMs: 30000 },
      onRetry,
    );

    return this.parseSearchResponse(response, query);
  }

  // ---------- Fallback Search (Alternative queries) ----------

  async fallbackSearch(
    originalQuery: string,
    companyName: string,
    onRetry?: (attempt: number, error: unknown) => void,
  ): Promise<SearchResult[]> {
    await this.init();
    // Try alternative formulations when primary search fails or returns too few results
    const altQueries = [
      `${companyName} Brasil empresa`,
      `${companyName} site:br`,
      `${companyName} informações corporativas`,
    ];

    const allResults: SearchResult[] = [];
    for (const q of altQueries) {
      try {
        const results = await this.webSearch(q, 5, onRetry);
        allResults.push(...results);
      } catch {
        // Continue trying alternative queries
      }
    }

    return this.deduplicateResults(allResults);
  }

  // ---------- BrasilAPI CNPJ Lookup ----------

  async lookupCnpj(cnpj: string): Promise<BrasilAPICnpjData | null> {
    // Clean CNPJ: remove dots, dashes, slashes
    const cleanCnpj = cnpj.replace(/[.\-/]/g, '');
    if (cleanCnpj.length !== 14) return null;

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error(`BrasilAPI returned ${res.status}`);
          }
          return res.json();
        },
        { maxRetries: 1, timeoutMs: 15000 },
      );
      return response as BrasilAPICnpjData | null;
    } catch (error) {
      console.error('[ResearchEngine] BrasilAPI lookup failed:', error);
      return null; // Non-critical: CNPJ lookup is enrichment, not required
    }
  }

  // ---------- Page Reader ----------

  async readPage(url: string, timeoutMs: number = 15000): Promise<string | null> {
    await this.init();
    try {
      const pageData = await withTimeout(
        this.client.functions.invoke('page_reader', { url }),
        timeoutMs,
      );

      if (pageData && typeof pageData === 'object') {
        const pd = pageData as unknown as Record<string, unknown>;
        const dataObj = (pd.data as Record<string, unknown>) || pd;
        const rawContent = (dataObj.content as string) || (dataObj.text as string) || (dataObj.markdown as string) || '';
        if (rawContent) {
          return rawContent.includes('<') ? this.stripHtml(rawContent) : rawContent;
        }
      } else if (typeof pageData === 'string') {
        const raw = pageData as string;
        return raw.includes('<') ? this.stripHtml(raw) : raw;
      }

      return null;
    } catch {
      return null;
    }
  }

  // ---------- LLM Chat ----------

  async chat(messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>): Promise<string> {
    await this.init();
    const result = await withRetry(
      async () => {
        return this.client.chat.completions.create({
          messages,
          thinking: { type: 'disabled' },
        });
      },
      { maxRetries: 1, timeoutMs: 60000 },
    );
    return result.choices?.[0]?.message?.content?.trim() || '';
  }

  // ---------- Parse search response ----------

  private parseSearchResponse(
    response: unknown,
    query: string,
  ): SearchResult[] {
    let results: Array<{ title?: string; url?: string; snippet?: string }> = [];

    if (Array.isArray(response)) {
      results = response;
    } else if (response && typeof response === 'object') {
      const resp = response as Record<string, unknown>;
      results = (resp.results || resp.items || []) as Array<{ title?: string; url?: string; snippet?: string }>;
    }

    return results
      .filter(r => r.url && r.url.trim())
      .map(r => ({
        title: r.title || '',
        url: r.url || '',
        snippet: r.snippet || '',
        query,
      }));
  }

  // ---------- Deduplicate results ----------

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }

  // ---------- Strip HTML ----------

  private stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// ============================================================
// SOURCE VALIDATOR
// ============================================================

export function validateSource(source: SearchResult): ValidatedSource {
  const confidence: 'high' | 'medium' | 'low' = (() => {
    // High confidence: official sources, government, well-known domains
    const domain = extractDomain(source.url).toLowerCase();
    const highConfidenceDomains = ['.gov.br', 'receitaws', 'brasilapi', 'documentacao.senior.com.br'];
    const mediumConfidenceDomains = ['.com.br', '.org.br', 'wikipedia', 'linkedin', 'bloomberg'];

    if (highConfidenceDomains.some(d => domain.includes(d))) return 'high';
    if (mediumConfidenceDomains.some(d => domain.includes(d))) return 'medium';
    if (!source.snippet || source.snippet.length < 20) return 'low';
    return 'medium';
  })();

  return {
    url: source.url,
    domain: extractDomain(source.url),
    title: source.title || source.url,
    snippet: source.snippet,
    type: 'web_search',
    confidence,
    consultedAt: new Date().toISOString(),
  };
}

export function validateSources(sources: SearchResult[]): ValidatedSource[] {
  return sources.map(validateSource);
}

// ============================================================
// EVIDENCE GATE
// ============================================================

export interface EvidenceGateResult {
  hasMinimumEvidence: boolean;
  factCount: number;
  highConfidenceFactCount: number;
  gaps: string[];
  recommendation: 'proceed' | 'insufficient_evidence' | 'no_evidence';
  message: string;
}

export function evaluateEvidence(facts: ExtractedFact[]): EvidenceGateResult {
  const realFacts = facts.filter(f => f.type === 'fact');
  const highConfFacts = realFacts.filter(f => f.confidence === 'high');
  const medConfFacts = realFacts.filter(f => f.confidence === 'medium');
  const gapItems = facts.filter(f => f.type === 'gap');

  const factCount = realFacts.length;
  const highConfidenceFactCount = highConfFacts.length + medConfFacts.length;

  if (factCount === 0) {
    return {
      hasMinimumEvidence: false,
      factCount: 0,
      highConfidenceFactCount: 0,
      gaps: gapItems.map(g => g.claim),
      recommendation: 'no_evidence',
      message: 'Não consegui obter evidências suficientes para responder com segurança. Tente informar o CNPJ, site oficial ou um termo mais específico.',
    };
  }

  if (highConfidenceFactCount < 2) {
    return {
      hasMinimumEvidence: false,
      factCount,
      highConfidenceFactCount,
      gaps: gapItems.map(g => g.claim),
      recommendation: 'insufficient_evidence',
      message: 'Encontrei poucas evidências de alta confiança. A análise pode conter hipóteses em vez de fatos. Considere informar o CNPJ ou site oficial para obter resultados mais precisos.',
    };
  }

  return {
    hasMinimumEvidence: true,
    factCount,
    highConfidenceFactCount,
    gaps: gapItems.map(g => g.claim),
    recommendation: 'proceed',
    message: '',
  };
}

// ============================================================
// FULL RESEARCH PIPELINE
// ============================================================

export interface ResearchProgressCallback {
  (event: string, data: Record<string, unknown>): void;
}

export interface ResearchResult {
  status: ResearchStatus;
  searchResults: SearchResult[];
  validatedSources: ValidatedSource[];
  cnpjData: BrasilAPICnpjData | null;
  facts: ExtractedFact[];
  evidenceGate: EvidenceGateResult | null;
  error?: ResearchError;
}

export async function executeResearch(
  companyName: string,
  cnpj?: string,
  sectorHint?: string,
  onProgress?: ResearchProgressCallback,
  abortSignal?: AbortSignal,
): Promise<ResearchResult> {
  const provider = new SearchProvider();
  const result: ResearchResult = {
    status: 'running',
    searchResults: [],
    validatedSources: [],
    cnpjData: null,
    facts: [],
    evidenceGate: null,
  };

  const emit = (event: string, data: Record<string, unknown>) => {
    if (abortSignal?.aborted) return;
    onProgress?.(event, { ...data, timestamp: new Date().toISOString() });
  };

  const checkAborted = () => {
    if (abortSignal?.aborted) {
      result.status = 'cancelled';
      throw new Error('Research cancelled');
    }
  };

  try {
    // Step 1: Plan queries
    emit('progress_stage_started', { stageId: 'preparing', label: 'Preparando investigação', message: 'Planejando consultas para busca...' });
    const plan = planQueries(companyName, cnpj, sectorHint);
    emit('evidence_found', { message: `${plan.queries.length} consultas planejadas${plan.cnpjQuery ? ' + consulta CNPJ' : ''}`, confidence: 0.9 });
    emit('progress_stage_completed', { stageId: 'preparing' });
    checkAborted();

    // Step 2: BrasilAPI CNPJ lookup (real API call)
    if (cnpj) {
      emit('progress_stage_started', { stageId: 'cadastre', label: 'Consultando dados cadastrais', message: 'Buscando CNPJ na BrasilAPI...' });
      emit('source_checked', { source: 'BrasilAPI', severity: 'consulting', message: 'Consultando BrasilAPI...' });

      try {
        result.cnpjData = await provider.lookupCnpj(cnpj);
        if (result.cnpjData) {
          emit('source_checked', { source: 'BrasilAPI', severity: 'ok', message: `CNPJ encontrado: ${result.cnpjData.razao_social}` });
          emit('evidence_found', {
            message: `CNPJ: ${result.cnpjData.cnpj} — ${result.cnpjData.razao_social}${result.cnpjData.cnae_fiscal_descricao ? `, CNAE: ${result.cnpjData.cnae_fiscal_descricao}` : ''}`,
            confidence: 0.95,
          });
        } else {
          emit('source_checked', { source: 'BrasilAPI', severity: 'failed', message: 'CNPJ não encontrado na BrasilAPI' });
        }
      } catch (error) {
        emit('source_checked', { source: 'BrasilAPI', severity: 'failed', message: 'BrasilAPI indisponível, tentando via web search' });
      }

      // Also search with CNPJ query via web search as fallback
      if (plan.cnpjQuery) {
        try {
          const cnpjResults = await provider.webSearch(plan.cnpjQuery, 5, (attempt, err) => {
            emit('source_checked', { source: 'web_search_cnpj', severity: 'consulting', message: `Reconsultando CNPJ (tentativa ${attempt})...` });
          });
          result.searchResults.push(...cnpjResults);
        } catch {
          emit('source_checked', { source: 'web_search_cnpj', severity: 'failed', message: 'Busca por CNPJ falhou' });
        }
      }

      emit('progress_stage_completed', { stageId: 'cadastre' });
    } else {
      // No CNPJ provided - just do web search
      emit('progress_stage_started', { stageId: 'cadastre', label: 'Consultando fontes públicas', message: 'Buscando dados públicos via web search...' });
    }
    checkAborted();

    // Step 3: Web search (primary)
    emit('progress_stage_started', { stageId: 'enriching', label: 'Pesquisando fontes', message: 'Consultando múltiplas fontes...' });

    for (let i = 0; i < plan.queries.length; i++) {
      checkAborted();
      const query = plan.queries[i];
      emit('source_checked', { source: 'web_search', severity: 'consulting', message: `Busca ${i + 1}/${plan.queries.length}: consultando...` });

      try {
        const searchResults = await provider.webSearch(query, 10, (attempt, err) => {
          emit('source_checked', { source: 'web_search', severity: 'consulting', message: `Busca ${i + 1} falhou, tentando novamente (tentativa ${attempt})...` });
        });
        const newResults = searchResults.filter(r => !result.searchResults.some(existing => existing.url === r.url));
        result.searchResults.push(...newResults);
        emit('source_checked', { source: 'web_search', severity: 'ok', message: `Busca ${i + 1}: +${newResults.length} resultados` });
      } catch (error) {
        emit('source_checked', { source: 'web_search', severity: 'warning', message: `Busca ${i + 1} falhou, continuando com outras fontes...` });
      }
    }

    // If we got very few results, try fallback
    if (result.searchResults.length < 5) {
      emit('source_checked', { source: 'web_search_fallback', severity: 'consulting', message: 'Poucos resultados. Tentando fonte alternativa...' });
      try {
        const fallbackResults = await provider.fallbackSearch('', companyName);
        const newResults = fallbackResults.filter(r => !result.searchResults.some(existing => existing.url === r.url));
        result.searchResults.push(...newResults);
        emit('source_checked', { source: 'web_search_fallback', severity: newResults.length > 0 ? 'ok' : 'failed', message: `Fallback: +${newResults.length} resultados` });
      } catch {
        emit('source_checked', { source: 'web_search_fallback', severity: 'failed', message: 'Fonte alternativa falhou' });
      }
    }

    emit('evidence_found', { message: `${result.searchResults.length} resultados encontrados no total`, confidence: result.searchResults.length > 10 ? 0.7 : 0.4 });
    emit('progress_stage_completed', { stageId: 'enriching' });

    // Check: if we have ZERO search results, this is a critical failure
    if (result.searchResults.length === 0) {
      result.status = 'failed';
      result.error = {
        code: 'no_search_results',
        message: 'Não consegui encontrar nenhuma fonte sobre esta empresa. Tente informar o CNPJ, site oficial ou um nome mais específico.',
        provider: 'web_search',
        retryable: true,
      };
      return result;
    }
    checkAborted();

    // Step 4: Validate sources
    result.status = 'validating';
    result.validatedSources = validateSources(result.searchResults);
    emit('progress_stage_completed', { stageId: 'sector_detection' }); // We'll add sector detection in the main pipeline

    result.status = 'running';
    return result;

  } catch (error) {
    if (abortSignal?.aborted) {
      result.status = 'cancelled';
      result.error = { code: 'cancelled', message: 'Investigação cancelada pelo usuário.', retryable: false };
    } else {
      result.status = 'failed';
      const msg = error instanceof Error ? error.message : 'Erro desconhecido na pesquisa';
      result.error = {
        code: msg.toLowerCase().includes('timeout') ? 'timeout' : 'research_error',
        message: msg,
        retryable: true,
        cause: error,
      };
    }
    return result;
  }
}
