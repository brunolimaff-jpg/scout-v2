import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const VALID_SECTORS = ['agro', 'construction', 'retail', 'industry', 'services', 'logistics'];

export async function GET() {
  try {
    const accounts = await db.crmAccount.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        investigation: {
          include: {
            portaScore: true,
          },
        },
      },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('List CRM accounts error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyName,
      cnpj,
      sector,
      contactName,
      contactEmail,
      contactPhone,
      stage,
      nextStep,
      notes,
      potentialValue,
      investigationId,
    } = body as {
      companyName: string;
      cnpj?: string;
      sector?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      stage?: string;
      nextStep?: string;
      notes?: string;
      potentialValue?: number;
      investigationId?: string;
    };

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return NextResponse.json(
        { error: 'companyName is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate stage if provided
    if (stage && !VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate sector if provided
    if (sector && !VALID_SECTORS.includes(sector)) {
      return NextResponse.json(
        { error: `Invalid sector. Must be one of: ${VALID_SECTORS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate investigationId if provided
    if (investigationId) {
      const investigation = await db.scoutInvestigation.findUnique({
        where: { id: investigationId },
        include: { portaScore: true },
      });

      if (!investigation) {
        return NextResponse.json(
          { error: 'Investigation not found' },
          { status: 404 }
        );
      }

      // Block CRM creation from non-completed or completed-without-PORTA investigations
      if (investigation.status !== 'completed') {
        return NextResponse.json(
          { error: 'Cannot create CRM account from a non-completed investigation. The investigation must be completed first.' },
          { status: 400 }
        );
      }

      if (!investigation.portaScore) {
        return NextResponse.json(
          { error: 'Cannot create CRM account from an investigation without a PORTA score. The investigation must have a validated score.' },
          { status: 400 }
        );
      }

      // Check if an account already exists for this investigation
      const existingAccount = await db.crmAccount.findUnique({
        where: { investigationId },
      });

      if (existingAccount) {
        return NextResponse.json(
          { error: 'An account already exists for this investigation', accountId: existingAccount.id },
          { status: 409 }
        );
      }
    }

    const account = await db.crmAccount.create({
      data: {
        companyName: companyName.trim(),
        cnpj: cnpj?.trim() || null,
        sector: sector || null,
        contactName: contactName?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        stage: stage || 'lead',
        nextStep: nextStep?.trim() || null,
        notes: notes?.trim() || null,
        potentialValue: potentialValue != null ? Number(potentialValue) : null,
        investigationId: investigationId || null,
      },
      include: {
        investigation: {
          include: {
            portaScore: true,
          },
        },
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error('Create CRM account error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
