import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// GET /api/warroom/sessions — List all sessions
// ============================================================
export async function GET() {
  try {
    const sessions = await db.warRoomSession.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        messageCount: s._count.messages,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[War Room Sessions GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/warroom/sessions — Create new session
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title } = body as { title?: string };

    const session = await db.warRoomSession.create({
      data: {
        title: title || 'Nova Sessão',
      },
    });

    return NextResponse.json({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error('[War Room Sessions POST Error]', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
