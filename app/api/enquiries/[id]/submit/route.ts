import { NextResponse } from "next/server";
import { submitEnquiry } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enquiry = await submitEnquiry(id);
  if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  return NextResponse.json({ enquiry });
}
