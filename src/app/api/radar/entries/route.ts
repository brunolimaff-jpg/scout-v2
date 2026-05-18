import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const entries = await db.radarEntry.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('List radar entries error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
