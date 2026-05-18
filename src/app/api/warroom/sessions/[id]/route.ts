import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// GET /api/warroom/sessions/[id] — Get session with messages and sources
// ============================================================
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await db.warRoomSession.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sources: {
              orderBy: { relevance: 'desc' },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        intent: m.intent,
        confidence: m.confidence,
        product: m.product,
        module: m.module,
        createdAt: m.createdAt,
        sources: m.sources.map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          snippet: s.snippet,
          relevance: s.relevance,
          consultedAt: s.consultedAt,
        })),
      })),
    });
  } catch (error) {
    console.error('[War Room Session GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/warroom/sessions/[id] — Delete session
// ============================================================
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await db.warRoomSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Cascade delete will handle messages and sources
    await db.warRoomSession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('[War Room Session DELETE Error]', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
