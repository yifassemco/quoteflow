import { NextResponse } from "next/server";
import { addUploadedFile, saveUploadedBytes } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
  }

  let enquiry = null;
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const storedPath = saveUploadedBytes(id, file.name, bytes);
    enquiry = await addUploadedFile(id, {
      originalName: file.name,
      storedPath,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    });
  }

  if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  return NextResponse.json({ enquiry });
}
