import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Total investigations
    const totalInvestigations = await db.scoutInvestigation.count();

    // Investigations by status
    const investigationsByStatus = await db.scoutInvestigation.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const statusBreakdown: Record<string, number> = {};
    for (const item of investigationsByStatus) {
      statusBreakdown[item.status] = item._count.status;
    }

    // Average PORTA score
    const portaScores = await db.portaScore.findMany({
      select: { total: true },
    });

    const avgPortaScore =
      portaScores.length > 0
        ? Math.round(
            (portaScores.reduce((sum, s) => sum + s.total, 0) / portaScores.length) * 100
          ) / 100
        : 0;

    // PORTA score dimension averages
    const portaAverages =
      portaScores.length > 0
        ? {
            porte: 0,
            operacao: 0,
            retorno: 0,
            tecnologia: 0,
            adocao: 0,
          }
        : null;

    // Actually get dimension averages
    if (portaScores.length > 0) {
      const allPortaScores = await db.portaScore.findMany({
        select: {
          porte: true,
          operacao: true,
          retorno: true,
          tecnologia: true,
          adocao: true,
          total: true,
        },
      });

      const count = allPortaScores.length;
      portaAverages!.porte = Math.round((allPortaScores.reduce((s, p) => s + p.porte, 0) / count) * 100) / 100;
      portaAverages!.operacao = Math.round((allPortaScores.reduce((s, p) => s + p.operacao, 0) / count) * 100) / 100;
      portaAverages!.retorno = Math.round((allPortaScores.reduce((s, p) => s + p.retorno, 0) / count) * 100) / 100;
      portaAverages!.tecnologia = Math.round((allPortaScores.reduce((s, p) => s + p.tecnologia, 0) / count) * 100) / 100;
      portaAverages!.adocao = Math.round((allPortaScores.reduce((s, p) => s + p.adocao, 0) / count) * 100) / 100;
    }

    // CRM accounts by stage
    const accountsByStage = await db.crmAccount.groupBy({
      by: ['stage'],
      _count: { stage: true },
    });

    const stageBreakdown: Record<string, number> = {};
    for (const item of accountsByStage) {
      stageBreakdown[item.stage] = item._count.stage;
    }

    const totalAccounts = await db.crmAccount.count();

    // Radar entries count
    const totalRadarEntries = await db.radarEntry.count();

    // Radar entries by category
    const radarByCategory = await db.radarEntry.groupBy({
      by: ['category'],
      _count: { category: true },
    });

    const categoryBreakdown: Record<string, number> = {};
    for (const item of radarByCategory) {
      categoryBreakdown[item.category] = item._count.category;
    }

    // Recent activity (last 10 combined events)
    const recentInvestigations = await db.scoutInvestigation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        companyName: true,
        status: true,
        createdAt: true,
      },
    });

    const recentAccounts = await db.crmAccount.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        companyName: true,
        stage: true,
        createdAt: true,
      },
    });

    const recentRadar = await db.radarEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        category: true,
        createdAt: true,
      },
    });

    // Combine and sort recent activity
    const recentActivity = [
      ...recentInvestigations.map((i) => ({
        type: 'investigation' as const,
        id: i.id,
        title: i.companyName,
        status: i.status,
        createdAt: i.createdAt,
      })),
      ...recentAccounts.map((a) => ({
        type: 'account' as const,
        id: a.id,
        title: a.companyName,
        status: a.stage,
        createdAt: a.createdAt,
      })),
      ...recentRadar.map((r) => ({
        type: 'radar' as const,
        id: r.id,
        title: r.title,
        status: r.category,
        createdAt: r.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    // Pipeline value
    const pipelineAccounts = await db.crmAccount.findMany({
      where: {
        stage: { notIn: ['closed_won', 'closed_lost'] },
        potentialValue: { not: null },
      },
      select: { potentialValue: true },
    });

    const pipelineValue = pipelineAccounts.reduce((sum, a) => sum + (a.potentialValue || 0), 0);

    return NextResponse.json({
      totalInvestigations,
      statusBreakdown,
      avgPortaScore,
      portaAverages,
      totalAccounts,
      stageBreakdown,
      totalRadarEntries,
      categoryBreakdown,
      recentActivity,
      pipelineValue,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
