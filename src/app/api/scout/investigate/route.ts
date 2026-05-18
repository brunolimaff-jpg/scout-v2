import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

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

    // Create investigation record in pending state
    const investigation = await db.scoutInvestigation.create({
      data: {
        companyName: trimmedName,
        cnpj: cnpj?.trim() || null,
        status: 'pending',
      },
    });

    // Update to investigating
    await db.scoutInvestigation.update({
      where: { id: investigation.id },
      data: { status: 'investigating' },
    });

    try {
      const zai = await ZAI.create();

      // Search for company information
      const searchQueries = [
        `"${trimmedName}" empresa Brasil CNPJ receita federal`,
        `"${trimmedName}" faturamento setor atuação`,
        `"${trimmedName}" tecnologia sistemas ERP gestão`,
      ];

      if (cnpj) {
        searchQueries.push(`"${cnpj}" receita federal`);
      }

      const allResults: Array<{ title: string; url: string; snippet: string }> = [];

      for (const query of searchQueries) {
        try {
          const searchResult = await zai.functions.invoke('web_search', {
            query,
            num: 10,
          }) as { results?: Array<{ title: string; url: string; snippet: string }> };

          if (searchResult?.results) {
            allResults.push(...searchResult.results);
          }
        } catch {
          // Continue with other queries even if one fails
        }
      }

      // Deduplicate results by URL
      const seenUrls = new Set<string>();
      const uniqueResults = allResults.filter((r) => {
        if (seenUrls.has(r.url)) return false;
        seenUrls.add(r.url);
        return true;
      });

      const rawData = JSON.stringify({
        searches: searchQueries,
        results: uniqueResults.slice(0, 20),
        searchedAt: new Date().toISOString(),
      });

      // Use LLM to analyze and create investigation summary + PORTA score
      const analysisPrompt = `Você é um analista de negócios sênior da Senior Sistemas, uma empresa brasileira de tecnologia que desenvolve soluções de ERP, gestão de pessoas, e business management para empresas no Brasil.

Analise as seguintes informações sobre a empresa "${trimmedName}"${cnpj ? ` (CNPJ: ${cnpj})` : ''} e forneça:

1. Um resumo executivo da empresa (tamanho, setor, operações, presença no mercado)
2. Uma análise PORTA (score 0-10 para cada dimensão):
   - P (Porte): Tamanho da empresa (0=micro, 10=gigante)
   - O (Operação): Complexidade operacional (0=simples, 10=muito complexa)
   - R (Retorno): Potencial de ROI para Senior (0=baixo, 10=alto)
   - T (Tecnologia): Prontidão tecnológica / maturidade digital (0=nenhuma, 10=alta)
   - A (Adoção): Prontidão para adoção de soluções Senior (0=resistente, 10=pronta)

Dados coletados da web:
${uniqueResults.map((r) => `- ${r.title}: ${r.snippet}`).join('\n')}

Se não houver dados suficientes, estime com base no que está disponível e indique incerteza.

Responda EXATAMENTE no formato JSON abaixo (sem markdown, sem code blocks):
{
  "summary": "resumo executivo aqui",
  "sector": "agro|construction|retail|industry|services|logistics",
  "porte": 0,
  "operacao": 0,
  "retorno": 0,
  "tecnologia": 0,
  "adocao": 0,
  "notes": {
    "porte": "justificativa",
    "operacao": "justificativa",
    "retorno": "justificativa",
    "tecnologia": "justificativa",
    "adocao": "justificativa"
  }
}`;

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'Você é um analista de negócios especializado em mercado brasileiro de tecnologia e ERP. Sempre responda em JSON válido.',
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        thinking: { type: 'disabled' },
      });

      const responseText = completion.choices?.[0]?.message?.content || '';

      // Parse the LLM response - try to extract JSON
      let analysisResult: Record<string, unknown>;
      try {
        // Try direct parse first
        analysisResult = JSON.parse(responseText);
      } catch {
        // Try to extract JSON from response (might have markdown wrapping)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to parse LLM analysis response');
        }
      }

      const summary = String(analysisResult.summary || '');
      const sector = String(analysisResult.sector || null);
      const porte = Math.min(10, Math.max(0, Number(analysisResult.porte) || 0));
      const operacao = Math.min(10, Math.max(0, Number(analysisResult.operacao) || 0));
      const retorno = Math.min(10, Math.max(0, Number(analysisResult.retorno) || 0));
      const tecnologia = Math.min(10, Math.max(0, Number(analysisResult.tecnologia) || 0));
      const adocao = Math.min(10, Math.max(0, Number(analysisResult.adocao) || 0));
      const notes = analysisResult.notes ? JSON.stringify(analysisResult.notes) : null;

      // Calculate weighted PORTA score
      const total = porte * 0.1 + operacao * 0.25 + retorno * 0.1 + tecnologia * 0.3 + adocao * 0.25;

      // Update investigation with results
      const updatedInvestigation = await db.scoutInvestigation.update({
        where: { id: investigation.id },
        data: {
          status: 'completed',
          summary,
          sector: sector === 'null' ? null : sector,
          rawData,
        },
      });

      // Create PORTA score
      const portaScore = await db.portaScore.create({
        data: {
          investigationId: investigation.id,
          porte,
          operacao,
          retorno,
          tecnologia,
          adocao,
          total: Math.round(total * 100) / 100,
          sector: sector === 'null' ? null : sector,
          notes,
        },
      });

      return NextResponse.json({
        investigation: updatedInvestigation,
        portaScore,
      });
    } catch (analysisError) {
      // Update investigation status to failed
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
        {
          error: 'Investigation failed during analysis',
          investigationId: investigation.id,
          details: analysisError instanceof Error ? analysisError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Scout investigate error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
