import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// ============================================================
// Utility: Strip HTML tags for clean text
// ============================================================
function stripHtml(html: string): string {
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

// ============================================================
// Intent classification prompt
// ============================================================
const INTENT_SYSTEM_PROMPT = `Você é um classificador de intenção para perguntas sobre a plataforma Senior.

Classifique a intenção em UMA das seguintes categorias:
- documentation: pergunta sobre documentação geral de um produto/módulo
- error: pergunta sobre um erro ou problema específico
- config: pergunta sobre como configurar algo
- step_by_step: pergunta pedindo um passo a passo de como fazer algo
- concept: pergunta sobre um conceito ou definição
- integration: pergunta sobre integração entre produtos/módulos
- business_rule: pergunta sobre regras de negócio, cálculos, fórmulas
- unrelated: pergunta que não tem relação com a plataforma Senior

Responda APENAS com a categoria, nada mais.

Pergunta: `;

// ============================================================
// Key term extraction prompt
// ============================================================
const KEY_TERMS_SYSTEM_PROMPT = `Você é um extrator de termos-chave para buscas na documentação Senior.

Extraia os seguintes termos da pergunta do usuário (retorne como JSON):
- product: nome do produto Senior mencionado (ex: "G5", "Sistemas Gestão", "Senior X", "HCM", "ERP"). Se não mencionado, null.
- module: nome do módulo mencionado (ex: "Folha", "Ponto", "Recrutamento", "Contábil"). Se não mencionado, null.
- screen: nome de tela mencionado. Se não mencionado, null.
- error: código ou mensagem de erro mencionada. Se não mencionado, null.
- entity: entidade principal (ex: "colaborador", "empresa", "centro de custo"). Se não mencionado, null.
- field: campo específico mencionado. Se não mencionado, null.
- process: processo mencionado (ex: "admissão", "rescisão", "férias", "apuração"). Se não mencionado, null.

Responda APENAS com o JSON, nada mais.

Pergunta: `;

// ============================================================
// Anti-hallucination answer generation prompt
// ============================================================
function buildAnswerSystemPrompt(context: string): string {
  return `Você é um assistente especializado na documentação oficial da Senior (documentacao.senior.com.br).

REGRAS ESTRITAS:
1. NUNCA afirme algo como verdade que não veio da documentação ou de fonte explicitamente marcada.
2. Se não encontrar fonte, responda que não encontrou.
3. Se a fonte for parcial, responda com confiança média/baixa.
4. NÃO invente nome de tela, parâmetro, campo ou rotina.
5. NÃO invente link.
6. Sempre prefixe respostas com "Com base na documentação Senior..." ou "A documentação indica que..."
7. Se a pergunta não for sobre documentação Senior, diga: "Essa pergunta parece mais adequada ao Scout/Radar/CRM do que ao War Room de documentação Senior."

Formato da resposta:
**Resposta direta:** [explicação curta e objetiva]
**Passo a passo:** [quando aplicável, liste os passos]
**Observações importantes:** [regras, exceções, limitações, pré-requisitos]
**Referências:** [links da documentação oficial usados]
**Confiança:** [Alta/Média/Baixa]
**Lacunas:** [o que não foi encontrado ou precisa validar]

CONTEXTO DA DOCUMENTAÇÃO ENCONTRADA:
${context}`;
}

// ============================================================
// Confidence assessment
// ============================================================
function assessConfidence(
  sources: { url: string; snippet: string; isFullContent?: boolean }[],
  intent: string
): 'high' | 'medium' | 'low' {
  if (intent === 'unrelated') return 'low';
  if (sources.length === 0) return 'low';
  const fullContentSources = sources.filter(s => s.isFullContent !== false);
  if (fullContentSources.length >= 3) return 'high';
  if (sources.length >= 3 && fullContentSources.length >= 1) return 'high';
  if (sources.length >= 2) return 'medium';
  if (sources.length >= 1) return 'medium';
  return 'low';
}

// ============================================================
// POST /api/warroom/chat
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message } = body as { sessionId?: string; message?: string };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    // ----------------------------------------------------------
    // Step 1: Classify intent
    // ----------------------------------------------------------
    let intent = 'documentation';
    try {
      const intentResult = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: INTENT_SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        thinking: { type: 'disabled' },
      });
      const rawIntent = intentResult.choices?.[0]?.message?.content?.trim().toLowerCase() || '';
      const validIntents = [
        'documentation',
        'error',
        'config',
        'step_by_step',
        'concept',
        'integration',
        'business_rule',
        'unrelated',
      ];
      intent = validIntents.includes(rawIntent) ? rawIntent : 'documentation';
    } catch {
      // Fallback to default intent
      intent = 'documentation';
    }

    // ----------------------------------------------------------
    // Step 2: Extract key terms
    // ----------------------------------------------------------
    let keyTerms: Record<string, string | null> = {};
    try {
      const termsResult = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: KEY_TERMS_SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        thinking: { type: 'disabled' },
      });
      const rawTerms = termsResult.choices?.[0]?.message?.content?.trim() || '{}';
      // Try to parse JSON, handling potential markdown code blocks
      const jsonStr = rawTerms.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      keyTerms = JSON.parse(jsonStr);
    } catch {
      keyTerms = {};
    }

    // ----------------------------------------------------------
    // Step 3: Build search query
    // ----------------------------------------------------------
    const searchParts: string[] = [message];
    if (keyTerms.product) searchParts.push(keyTerms.product);
    if (keyTerms.module) searchParts.push(keyTerms.module);
    if (keyTerms.process) searchParts.push(keyTerms.process);
    if (keyTerms.error) searchParts.push(keyTerms.error);
    const searchQuery = searchParts.join(' ') + ' site:documentacao.senior.com.br';

    // ----------------------------------------------------------
    // Step 4: Search Senior documentation
    // ----------------------------------------------------------
    interface SearchHit {
      url: string;
      title?: string;
      snippet?: string;
      [key: string]: unknown;
    }

    let searchResults: SearchHit[] = [];
    try {
      const searchResponse = await zai.functions.invoke('web_search', {
        query: searchQuery,
        num: 10,
      });
      // The web_search function returns results in various formats
      if (Array.isArray(searchResponse)) {
        searchResults = searchResponse;
      } else if (searchResponse && typeof searchResponse === 'object') {
        const resp = searchResponse as Record<string, unknown>;
        if (Array.isArray(resp.results)) {
          searchResults = resp.results as SearchHit[];
        } else if (Array.isArray(resp.items)) {
          searchResults = resp.items as SearchHit[];
        }
      }
    } catch {
      searchResults = [];
    }

    // ----------------------------------------------------------
    // Step 5: Read top pages (with snippet fallback)
    // ----------------------------------------------------------
    interface PageContent {
      url: string;
      title: string;
      content: string;
      isFullContent: boolean; // true if from page_reader, false if snippet-only
    }

    const pagesToRead = searchResults.slice(0, 5);
    const pageContents: PageContent[] = [];

    // Helper: timeout wrapper for promises
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);

    for (const result of pagesToRead) {
      const url = result.url;
      if (!url || !url.includes('documentacao.senior.com.br')) continue;

      try {
        // Check cache first
        const cached = await db.documentationPage.findUnique({
          where: { url },
        });

        if (cached && cached.content.length > 50) {
          pageContents.push({
            url: cached.url,
            title: cached.title,
            content: cached.content.slice(0, 8000),
            isFullContent: true,
          });
        } else {
          // Try page_reader with 15s timeout
          const pageData = await withTimeout(
            zai.functions.invoke('page_reader', { url }),
            15000
          );

          let extractedContent = '';
          let extractedTitle = result.title || url;
          let isFullContent = false;

          if (pageData && typeof pageData === 'object') {
            const pd = pageData as Record<string, unknown>;
            // page_reader returns { data: { title, html, ... } } or { title, content, ... }
            const dataObj = (pd.data as Record<string, unknown>) || pd;
            const rawContent =
              (dataObj.content as string) ||
              (dataObj.text as string) ||
              (dataObj.markdown as string) ||
              (dataObj.html as string) ||
              '';
            // Strip HTML for clean text
            extractedContent = rawContent.includes('<') ? stripHtml(rawContent) : rawContent;
            extractedTitle = (dataObj.title as string) || extractedTitle;
          } else if (typeof pageData === 'string') {
            const raw = pageData as string;
            extractedContent = raw.includes('<') ? stripHtml(raw) : raw;
          }

          // Truncate to avoid massive prompts
          extractedContent = extractedContent.slice(0, 8000);

          if (extractedContent.length > 50) {
            isFullContent = true;
            // Cache the page
            try {
              await db.documentationPage.upsert({
                where: { url },
                update: {
                  title: extractedTitle,
                  content: extractedContent,
                  product: keyTerms.product || null,
                  module: keyTerms.module || null,
                },
                create: {
                  url,
                  title: extractedTitle,
                  content: extractedContent,
                  product: keyTerms.product || null,
                  module: keyTerms.module || null,
                },
              });
            } catch {
              // Cache write failure is non-critical
            }
          } else {
            // Fallback: use search snippet as context
            const snippet = result.snippet || '';
            if (snippet.length > 0) {
              extractedContent = `[Resumo da página]: ${snippet}`;
              isFullContent = false;
            }
          }

          if (extractedContent.length > 0) {
            pageContents.push({
              url,
              title: extractedTitle,
              content: extractedContent,
              isFullContent,
            });
          }
        }
      } catch {
        // Page read failure — try using snippet as fallback
        const snippet = result.snippet || '';
        if (snippet.length > 0) {
          pageContents.push({
            url,
            title: result.title || url,
            content: `[Resumo da página]: ${snippet}`,
            isFullContent: false,
          });
        }
      }
    }

    // If we have no page content but have search snippets, add remaining snippets
    if (pageContents.length === 0) {
      for (const result of searchResults.slice(0, 8)) {
        const url = result.url;
        if (!url || !url.includes('documentacao.senior.com.br')) continue;
        const snippet = result.snippet || result.title || '';
        if (snippet.length > 0) {
          pageContents.push({
            url,
            title: result.title || url,
            content: `[Resumo da página]: ${snippet}`,
            isFullContent: false,
          });
        }
      }
    }

    // ----------------------------------------------------------
    // Step 6: Build context and generate answer
    // ----------------------------------------------------------
    const context = pageContents
      .map((p, i) => {
        const tag = p.isFullContent ? 'Conteúdo completo' : 'Resumo/snippet';
        return `[Fonte ${i + 1}: ${p.title} (${p.url}) - ${tag}]\n${p.content}`;
      })
      .join('\n\n---\n\n');

    const hasContext = context.trim().length > 0;
    const finalContext = hasContext
      ? context
      : 'Nenhuma documentação foi encontrada para esta pergunta.';

    let answer = '';
    try {
      const answerResult = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: buildAnswerSystemPrompt(finalContext) },
          { role: 'user', content: message },
        ],
        thinking: { type: 'disabled' },
      });
      answer = answerResult.choices?.[0]?.message?.content || '';
    } catch {
      answer =
        'Com base na documentação Senior... Não foi possível gerar uma resposta no momento. Por favor, tente novamente.';
    }

    // ----------------------------------------------------------
    // Step 7: Assess confidence
    // ----------------------------------------------------------
    const confidence = assessConfidence(
      pageContents.map((p) => ({ url: p.url, snippet: p.content.slice(0, 200), isFullContent: p.isFullContent })),
      intent
    );

    // ----------------------------------------------------------
    // Step 8: Extract gaps from answer
    // ----------------------------------------------------------
    let gaps: string[] = [];
    if (confidence === 'low' || pageContents.length === 0) {
      gaps.push('Nenhuma documentação relevante foi encontrada');
    }
    if (intent === 'unrelated') {
      gaps.push('Pergunta fora do escopo da documentação Senior');
    }
    if (pageContents.length > 0 && pageContents.length < 3) {
      gaps.push('Poucas fontes encontradas — a resposta pode ser incompleta');
    }
    const snippetOnlySources = pageContents.filter(p => !p.isFullContent);
    if (snippetOnlySources.length > 0 && snippetOnlySources.length === pageContents.length) {
      gaps.push('Apenas resumos das páginas foram encontrados (leitura completa indisponível) — recomenda-se consultar os links diretamente');
    }

    // ----------------------------------------------------------
    // Step 9: Save to database
    // ----------------------------------------------------------
    // Create or find session
    let session;
    if (sessionId) {
      session = await db.warRoomSession.findUnique({
        where: { id: sessionId },
      });
    }

    if (!session) {
      // Auto-generate title from first message
      let title = message.slice(0, 60);
      if (message.length > 60) title += '...';
      session = await db.warRoomSession.create({
        data: {
          title,
        },
      });
    }

    // Save user message
    const userMessage = await db.warRoomMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        intent,
        product: keyTerms.product || null,
        module: keyTerms.module || null,
      },
    });

    // Save assistant message
    const assistantMessage = await db.warRoomMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: answer,
        intent,
        confidence,
        product: keyTerms.product || null,
        module: keyTerms.module || null,
      },
    });

    // Save sources linked to assistant message
    const sourceRecords = [];
    for (let i = 0; i < pageContents.length; i++) {
      const page = pageContents[i];
      const source = await db.warRoomSource.create({
        data: {
          messageId: assistantMessage.id,
          title: page.title,
          url: page.url,
          snippet: page.content.slice(0, 500),
          relevance: 1 - i * 0.15, // Decrease relevance for lower-ranked results
        },
      });
      sourceRecords.push(source);
    }

    // ----------------------------------------------------------
    // Step 10: Return structured response
    // ----------------------------------------------------------
    return NextResponse.json({
      sessionId: session.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      answer,
      intent,
      confidence,
      keyTerms,
      sources: sourceRecords.map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        snippet: s.snippet,
        relevance: s.relevance,
      })),
      gaps,
    });
  } catch (error) {
    console.error('[War Room Chat Error]', error);
    return NextResponse.json(
      { error: 'Internal server error in War Room chat' },
      { status: 500 }
    );
  }
}
