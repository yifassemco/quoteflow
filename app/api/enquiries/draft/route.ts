import { NextResponse } from "next/server";
import { createDraft } from "@/lib/store";
import type { EnquiryInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<EnquiryInput>;
  if (!body.company || !body.email) {
    return NextResponse.json({ error: "Company and email are required to create a return reference." }, { status: 400 });
  }

  const enquiry = await createDraft(body);
  return NextResponse.json({ enquiry }, { status: 201 });
}
