import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const investigation = await db.scoutInvestigation.findUnique({
      where: { id },
      include: {
        portaScore: true,
        crmAccount: true,
      },
    });

    if (!investigation) {
      return NextResponse.json(
        { error: 'Investigation not found' },
        { status: 404 }
      );
    }

    // Data integrity: strip portaScore from non-completed investigations
    if (investigation.status !== 'completed') {
      investigation.portaScore = null;
    }

    // For failed investigations, provide error state context
    if (investigation.status === 'failed') {
      return NextResponse.json({
        investigation,
        errorState: {
          type: 'insufficient_evidence',
          message: investigation.summary
            ? 'Investigação não conseguiu coletar evidências suficientes.'
            : 'Investigação falhou — sem dados coletados.',
          canRetry: true,
        },
      });
    }

    // For pending/investigating, provide status context
    if (investigation.status === 'pending' || investigation.status === 'investigating') {
      return NextResponse.json({
        investigation,
        errorState: {
          type: 'in_progress',
          message: 'Investigação ainda está em andamento.',
          canRetry: false,
        },
      });
    }

    return NextResponse.json({ investigation });
  } catch (error) {
    console.error('Get investigation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const investigation = await db.scoutInvestigation.findUnique({
      where: { id },
    });

    if (!investigation) {
      return NextResponse.json(
        { error: 'Investigation not found' },
        { status: 404 }
      );
    }

    // Cascade delete will handle portaScore
    await db.scoutInvestigation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Investigation deleted' });
  } catch (error) {
    console.error('Delete investigation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
