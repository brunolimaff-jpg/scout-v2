import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// GET /api/warroom/history — Get all messages across sessions (paginated)
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      db.warRoomMessage.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          session: {
            select: {
              id: true,
              title: true,
            },
          },
          sources: {
            orderBy: { relevance: 'desc' },
            select: {
              id: true,
              title: true,
              url: true,
              relevance: true,
            },
          },
        },
      }),
      db.warRoomMessage.count(),
    ]);

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        sessionTitle: m.session.title,
        role: m.role,
        content: m.content,
        intent: m.intent,
        confidence: m.confidence,
        product: m.product,
        module: m.module,
        createdAt: m.createdAt,
        sources: m.sources,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error('[War Room History GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to get history' },
      { status: 500 }
    );
  }
}
