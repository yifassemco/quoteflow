import { NextResponse } from "next/server";
import { createEnquiry } from "@/lib/scoring";
import { readEnquiries } from "@/lib/store";
import type { EnquiryInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference");
  const email = url.searchParams.get("email");
  const enquiries = await readEnquiries();
  if (reference && email) {
    return NextResponse.json({
      enquiries: enquiries.filter((item) => item.reference.toLowerCase() === reference.toLowerCase() && item.data.email.toLowerCase() === email.toLowerCase()),
    });
  }
  return NextResponse.json({ enquiries });
}

export async function POST(request: Request) {
  const body = (await request.json()) as EnquiryInput;
  if (!body.company || !body.email) {
    return NextResponse.json({ error: "Company and email are required." }, { status: 400 });
  }

  const enquiries = await readEnquiries();
  const enquiry = createEnquiry(body, enquiries.length);

  return NextResponse.json({ enquiry }, { status: 201 });
}
