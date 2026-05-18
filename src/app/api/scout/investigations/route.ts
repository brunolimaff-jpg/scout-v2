import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const investigations = await db.scoutInvestigation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        portaScore: {
          // Only include PORTA scores for completed investigations
          where: {
            investigation: { status: 'completed' },
          },
        },
      },
    });

    // Data integrity: for non-completed investigations, strip portaScore from response
    const cleanInvestigations = investigations.map((inv) => {
      if (inv.status !== 'completed') {
        return { ...inv, portaScore: null };
      }
      return inv;
    });

    return NextResponse.json({ investigations: cleanInvestigations });
  } catch (error) {
    console.error('List investigations error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scout/investigations
 * One-time cleanup endpoint to fix invalid data integrity.
 * Marks completed investigations with no summary/sources/evidences as failed,
 * deletes orphaned PORTA scores, and deletes CRM accounts linked to failed investigations.
 */
export async function POST() {
  try {
    const results = {
      investigationsMarkedFailed: 0,
      orphanScoresDeleted: 0,
      failedCrmAccountsDeleted: 0,
    };

    // Step 1: Mark investigations as 'failed' if they are 'completed' but have no summary, sources, or evidences
    const completed = await db.scoutInvestigation.findMany({
      where: { status: 'completed' },
      select: { id: true, companyName: true, summary: true, sources: true, evidences: true },
    });

    for (const inv of completed) {
      const hasSummary = inv.summary && inv.summary.trim().length > 0;
      const hasSources = inv.sources && inv.sources !== '[]' && inv.sources.trim().length > 0;
      const hasEvidences = inv.evidences && inv.evidences !== '[]' && inv.evidences.trim().length > 0;

      if (!hasSummary && !hasSources && !hasEvidences) {
        await db.scoutInvestigation.update({
          where: { id: inv.id },
          data: { status: 'failed' },
        });
        results.investigationsMarkedFailed++;
      }
    }

    // Step 2: Delete PORTA scores for non-completed investigations
    const orphanScores = await db.portaScore.findMany({
      where: { investigation: { status: { not: 'completed' } } },
      select: { id: true },
    });

    for (const score of orphanScores) {
      await db.portaScore.delete({ where: { id: score.id } });
      results.orphanScoresDeleted++;
    }

    // Step 3: Delete CRM accounts linked to failed investigations
    const failedCrm = await db.crmAccount.findMany({
      where: { investigation: { status: 'failed' } },
      select: { id: true },
    });

    for (const account of failedCrm) {
      await db.crmAccount.delete({ where: { id: account.id } });
      results.failedCrmAccountsDeleted++;
    }

    return NextResponse.json({
      message: 'Data cleanup completed',
      results,
    });
  } catch (error) {
    console.error('Cleanup investigations error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
