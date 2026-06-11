import { NextResponse } from "next/server";
import { readEnquiry, recordDecision, updateEnquiry } from "@/lib/store";
import type { EnquiryInput, IntakeStage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enquiry = await readEnquiry(id);
  if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  return NextResponse.json({ enquiry });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = (await request.json()) as { decision?: string; data?: Partial<EnquiryInput>; currentStage?: IntakeStage };
  const { id } = await params;

  if (body.decision) {
    const enquiries = await recordDecision(id, body.decision);
    if (!enquiries) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    return NextResponse.json({ enquiries });
  }

  if (!body.data) {
    return NextResponse.json({ error: "Stage data or decision is required." }, { status: 400 });
  }

  const enquiry = await updateEnquiry(id, body.data, body.currentStage);
  if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  return NextResponse.json({ enquiry });
}
