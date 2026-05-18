// Runtime-safe persistence helpers for Vercel/serverless demos.
//
// The project currently uses SQLite through Prisma. SQLite is fine locally, but
// Vercel serverless can fail when the database file/table is missing or the
// filesystem is read-only. Bruno asked not to migrate to Neon/Supabase yet, so
// these helpers keep the app functional without external persistence.
//
// Rule: try Prisma first. If Prisma fails, fall back to process memory. This is
// intentionally non-durable and should be replaced when the unified project gets
// a real database.

type AnyDb = any;
type AnyRecord = Record<string, any>;

type MemoryState = {
  scoutInvestigations: AnyRecord[];
  portaScores: AnyRecord[];
  warRoomSessions: AnyRecord[];
  warRoomMessages: AnyRecord[];
  warRoomSources: AnyRecord[];
};

type GlobalWithMemory = typeof globalThis & {
  __seniorScoutRuntimeStore?: MemoryState;
};

const globalMemory = globalThis as GlobalWithMemory;

function store(): MemoryState {
  if (!globalMemory.__seniorScoutRuntimeStore) {
    globalMemory.__seniorScoutRuntimeStore = {
      scoutInvestigations: [],
      portaScores: [],
      warRoomSessions: [],
      warRoomMessages: [],
      warRoomSources: [],
    };
  }
  return globalMemory.__seniorScoutRuntimeStore;
}

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function now(): Date {
  return new Date();
}

function warn(scope: string, error: unknown) {
  console.warn(`[runtime-store] Prisma unavailable in ${scope}; using memory fallback`, error instanceof Error ? error.message : String(error));
}

export async function safeScoutCreate(db: AnyDb, data: AnyRecord): Promise<AnyRecord> {
  try {
    return await db.scoutInvestigation.create({ data });
  } catch (error) {
    warn('safeScoutCreate', error);
    const createdAt = now();
    const investigation = {
      id: id('inv'),
      companyName: data.companyName,
      cnpj: data.cnpj ?? null,
      sector: data.sector ?? null,
      subSector: data.subSector ?? null,
      status: data.status ?? 'investigating',
      summary: data.summary ?? null,
      rawData: data.rawData ?? null,
      evidences: data.evidences ?? null,
      classification: data.classification ?? null,
      commercialThesis: data.commercialThesis ?? null,
      sources: data.sources ?? null,
      qualityCheck: data.qualityCheck ?? null,
      createdAt,
      updatedAt: createdAt,
      portaScore: null,
      crmAccount: null,
    };
    store().scoutInvestigations.unshift(investigation);
    return investigation;
  }
}

export async function safeScoutUpdate(db: AnyDb, investigationId: string, data: AnyRecord): Promise<AnyRecord> {
  try {
    return await db.scoutInvestigation.update({ where: { id: investigationId }, data });
  } catch (error) {
    warn('safeScoutUpdate', error);
    const memory = store();
    const index = memory.scoutInvestigations.findIndex((item) => item.id === investigationId);
    if (index >= 0) {
      memory.scoutInvestigations[index] = {
        ...memory.scoutInvestigations[index],
        ...data,
        updatedAt: now(),
      };
      return memory.scoutInvestigations[index];
    }
    const createdAt = now();
    const fallback = {
      id: investigationId,
      companyName: data.companyName ?? 'Investigação',
      cnpj: data.cnpj ?? null,
      status: data.status ?? 'failed',
      createdAt,
      updatedAt: createdAt,
      ...data,
      portaScore: null,
      crmAccount: null,
    };
    memory.scoutInvestigations.unshift(fallback);
    return fallback;
  }
}

export async function safePortaScoreCreate(db: AnyDb, data: AnyRecord): Promise<AnyRecord> {
  try {
    return await db.portaScore.create({ data });
  } catch (error) {
    warn('safePortaScoreCreate', error);
    const createdAt = now();
    const score = {
      id: id('porta'),
      ...data,
      createdAt,
      updatedAt: createdAt,
    };
    store().portaScores.unshift(score);
    const inv = store().scoutInvestigations.find((item) => item.id === data.investigationId);
    if (inv) inv.portaScore = score;
    return score;
  }
}

export async function safeScoutFindMany(db: AnyDb): Promise<AnyRecord[]> {
  try {
    const investigations = await db.scoutInvestigation.findMany({
      orderBy: { createdAt: 'desc' },
      include: { portaScore: true },
    });
    return investigations.map((inv: AnyRecord) => inv.status === 'completed' ? inv : { ...inv, portaScore: null });
  } catch (error) {
    warn('safeScoutFindMany', error);
    return store().scoutInvestigations
      .map((inv) => {
        const portaScore = inv.status === 'completed'
          ? (inv.portaScore ?? store().portaScores.find((score) => score.investigationId === inv.id) ?? null)
          : null;
        return { ...inv, portaScore };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function safeScoutFindUnique(db: AnyDb, investigationId: string): Promise<AnyRecord | null> {
  try {
    const inv = await db.scoutInvestigation.findUnique({
      where: { id: investigationId },
      include: { portaScore: true, crmAccount: true },
    });
    if (!inv) return null;
    return inv.status === 'completed' ? inv : { ...inv, portaScore: null };
  } catch (error) {
    warn('safeScoutFindUnique', error);
    const inv = store().scoutInvestigations.find((item) => item.id === investigationId);
    if (!inv) return null;
    const portaScore = inv.status === 'completed'
      ? (inv.portaScore ?? store().portaScores.find((score) => score.investigationId === inv.id) ?? null)
      : null;
    return { ...inv, portaScore };
  }
}

export async function safeScoutDelete(db: AnyDb, investigationId: string): Promise<boolean> {
  try {
    await db.scoutInvestigation.delete({ where: { id: investigationId } });
    return true;
  } catch (error) {
    warn('safeScoutDelete', error);
    const memory = store();
    const before = memory.scoutInvestigations.length;
    memory.scoutInvestigations = memory.scoutInvestigations.filter((item) => item.id !== investigationId);
    memory.portaScores = memory.portaScores.filter((score) => score.investigationId !== investigationId);
    return memory.scoutInvestigations.length !== before;
  }
}

export async function safeWarRoomPersist(db: AnyDb, input: {
  sessionId?: string;
  message: string;
  answer: string;
  intent: string | null;
  confidence: string | null;
  product: string | null;
  module: string | null;
  sources: Array<{ title: string; url: string; snippet: string; relevance: number }>;
}): Promise<{
  sessionId: string;
  userMessageId: string;
  assistantMessageId: string;
  sources: Array<{ id: string; title: string; url: string; snippet: string; relevance: number }>;
}> {
  try {
    let session = input.sessionId ? await db.warRoomSession.findUnique({ where: { id: input.sessionId } }) : null;
    if (!session) {
      let title = input.message.slice(0, 60);
      if (input.message.length > 60) title += '...';
      session = await db.warRoomSession.create({ data: { title } });
    }

    const userMessage = await db.warRoomMessage.create({
      data: { sessionId: session.id, role: 'user', content: input.message, intent: input.intent, product: input.product, module: input.module },
    });

    const assistantMessage = await db.warRoomMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: input.answer, intent: input.intent, confidence: input.confidence, product: input.product, module: input.module },
    });

    const sourceRecords = [];
    for (const source of input.sources) {
      const created = await db.warRoomSource.create({
        data: { messageId: assistantMessage.id, title: source.title, url: source.url, snippet: source.snippet, relevance: source.relevance },
      });
      sourceRecords.push({ id: created.id, title: created.title, url: created.url, snippet: created.snippet, relevance: created.relevance });
    }

    return { sessionId: session.id, userMessageId: userMessage.id, assistantMessageId: assistantMessage.id, sources: sourceRecords };
  } catch (error) {
    warn('safeWarRoomPersist', error);
    const memory = store();
    const createdAt = now();
    let session = input.sessionId ? memory.warRoomSessions.find((item) => item.id === input.sessionId) : null;
    if (!session) {
      session = { id: id('wr_session'), title: input.message.slice(0, 60), createdAt, updatedAt: createdAt };
      memory.warRoomSessions.unshift(session);
    }
    const userMessage = { id: id('wr_user'), sessionId: session.id, role: 'user', content: input.message, intent: input.intent, product: input.product, module: input.module, createdAt };
    const assistantMessage = { id: id('wr_assistant'), sessionId: session.id, role: 'assistant', content: input.answer, intent: input.intent, confidence: input.confidence, product: input.product, module: input.module, createdAt };
    memory.warRoomMessages.push(userMessage, assistantMessage);
    const sources = input.sources.map((source) => ({ id: id('wr_source'), ...source }));
    memory.warRoomSources.push(...sources.map((source) => ({ ...source, messageId: assistantMessage.id, consultedAt: createdAt })));
    return { sessionId: session.id, userMessageId: userMessage.id, assistantMessageId: assistantMessage.id, sources };
  }
}
