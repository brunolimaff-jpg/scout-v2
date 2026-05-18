import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const VALID_CATEGORIES = ['competitor', 'market_trend', 'regulation', 'technology', 'opportunity'];
const VALID_SECTORS = ['agro', 'construction', 'retail', 'industry', 'services', 'logistics'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, category, sector } = body as {
      query: string;
      category?: string;
      sector?: string;
    };

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();

    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (sector && !VALID_SECTORS.includes(sector)) {
      return NextResponse.json(
        { error: `Invalid sector. Must be one of: ${VALID_SECTORS.join(', ')}` },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    // Build search queries relevant to Senior's business (ERP, HR, business management in Brazil)
    const searchQueries = [
      `${trimmedQuery} mercado Brasil ERP gestão empresarial`,
      `${trimmedQuery} concorrência tendência tecnologia`,
    ];

    if (sector) {
      searchQueries.push(`${trimmedQuery} setor ${sector} Brasil`);
    }

    const allResults: Array<{ title: string; url: string; snippet: string }> = [];

    for (const q of searchQueries) {
      try {
        const searchResult = await zai.functions.invoke('web_search', {
          query: q,
          num: 10,
        }) as { results?: Array<{ title: string; url: string; snippet: string }> };

        if (searchResult?.results) {
          allResults.push(...searchResult.results);
        }
      } catch {
        // Continue with other queries
      }
    }

    // Deduplicate
    const seenUrls = new Set<string>();
    const uniqueResults = allResults.filter((r) => {
      if (seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });

    if (uniqueResults.length === 0) {
      return NextResponse.json({
        message: 'No results found for the given query',
        entries: [],
      });
    }

    // Use LLM to summarize and categorize
    const analysisPrompt = `Você é um analista de inteligência competitiva da Senior Sistemas, empresa brasileira de tecnologia que desenvolve soluções de ERP, gestão de pessoas e business management.

Analise os seguintes resultados de busca sobre "${trimmedQuery}" e crie entradas de radar com inteligência competitiva relevante.

Resultados da busca:
${uniqueResults.slice(0, 15).map((r) => `- ${r.title}: ${r.snippet} (${r.url})`).join('\n')}

Crie até 5 entradas de radar relevantes. Cada entrada deve ter:
- title: título curto e descritivo
- category: uma de [competitor, market_trend, regulation, technology, opportunity]${category ? ` (preferência: ${category})` : ''}
- sector: setor relevante se aplicável [agro, construction, retail, industry, services, logistics]${sector ? ` (preferência: ${sector})` : ''}
- summary: resumo em 2-3 frases com insight acionável
- source: nome da fonte
- sourceUrl: URL da fonte
- relevance: relevância para Senior (0-10)

Responda EXATAMENTE no formato JSON (sem markdown, sem code blocks):
{
  "entries": [
    {
      "title": "...",
      "category": "...",
      "sector": "...",
      "summary": "...",
      "source": "...",
      "sourceUrl": "...",
      "relevance": 0
    }
  ]
}`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Você é um analista de inteligência competitiva. Sempre responda em JSON válido.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const responseText = completion.choices?.[0]?.message?.content || '';

    let parsedResult: { entries: Array<Record<string, unknown>> };
    try {
      parsedResult = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse LLM radar analysis response');
      }
    }

    const entries = parsedResult.entries || [];

    // Save entries to database
    const savedEntries = await Promise.all(
      entries.map((entry) =>
        db.radarEntry.create({
          data: {
            title: String(entry.title || trimmedQuery),
            category: VALID_CATEGORIES.includes(String(entry.category))
              ? String(entry.category)
              : (category || 'market_trend'),
            sector: VALID_SECTORS.includes(String(entry.sector))
              ? String(entry.sector)
              : (sector || null),
            summary: String(entry.summary || ''),
            source: String(entry.source || ''),
            sourceUrl: String(entry.sourceUrl || ''),
            relevance: Math.min(10, Math.max(0, Number(entry.relevance) || 0)),
          },
        })
      )
    );

    return NextResponse.json({ entries: savedEntries });
  } catch (error) {
    console.error('Radar search error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
