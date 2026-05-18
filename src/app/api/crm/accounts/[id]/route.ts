import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const VALID_SECTORS = ['agro', 'construction', 'retail', 'industry', 'services', 'logistics'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const account = await db.crmAccount.findUnique({
      where: { id },
      include: {
        investigation: {
          include: {
            portaScore: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ account });
  } catch (error) {
    console.error('Get CRM account error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingAccount = await db.crmAccount.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

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
    } = body as {
      companyName?: string;
      cnpj?: string;
      sector?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      stage?: string;
      nextStep?: string;
      notes?: string;
      potentialValue?: number;
    };

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

    // Build update data - only include fields that are provided
    const updateData: Record<string, unknown> = {};

    if (companyName !== undefined) updateData.companyName = companyName.trim();
    if (cnpj !== undefined) updateData.cnpj = cnpj?.trim() || null;
    if (sector !== undefined) updateData.sector = sector || null;
    if (contactName !== undefined) updateData.contactName = contactName?.trim() || null;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail?.trim() || null;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone?.trim() || null;
    if (stage !== undefined) updateData.stage = stage;
    if (nextStep !== undefined) updateData.nextStep = nextStep?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (potentialValue !== undefined) updateData.potentialValue = potentialValue != null ? Number(potentialValue) : null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const updatedAccount = await db.crmAccount.update({
      where: { id },
      data: updateData,
      include: {
        investigation: {
          include: {
            portaScore: true,
          },
        },
      },
    });

    return NextResponse.json({ account: updatedAccount });
  } catch (error) {
    console.error('Update CRM account error:', error);
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

    const account = await db.crmAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    await db.crmAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('Delete CRM account error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
