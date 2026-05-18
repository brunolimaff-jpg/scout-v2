import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const investigations = await db.scoutInvestigation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        portaScore: true,
      },
    });

    return NextResponse.json({ investigations });
  } catch (error) {
    console.error('List investigations error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
