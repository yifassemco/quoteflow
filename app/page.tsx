"use client";

import { useEffect, useMemo, useState } from "react";
import type { Enquiry, EnquiryInput, IntakeStage, ProductType } from "@/lib/types";

const emptyForm: EnquiryInput = {
  company: "",
  email: "",
  contactName: "",
  productType: "hotfill",
  runVolume: 0,
  frequency: "monthly",
  productStage: "ready",
  urgency: "standard",
  notes: "",
  hasPrimaryPackaging: false,
  hasSecondaryPackaging: false,
  hasProductSpecs: false,
  hasAllergens: false,
  hasSpecSheet: false,
  specDocumentsCount: 0,
  productPhotosCount: 0,
  ndaOption: "none",
  ndaDocumentsCount: 0,
  productDetails: "",
  packageFormat: "",
  packagingDesign: "",
  onsitePreparation: "",
  qaConsiderations: "",
  freeIssuedItems: "",
  pakcoSourcedItems: "",
  extractionConfirmed: false,
};

const productOptions: { value: ProductType; label: string }[] = [
  { value: "hotfill", label: "Hot-fill / jarring" },
  { value: "ambientLiquid", label: "Ambient liquid filling" },
  { value: "viscous", label: "Sauce, syrup, paste, or viscous filling" },
  { value: "dryFill", label: "Dry powder, granule, or dry goods filling" },
  { value: "pouch", label: "Pouch, sachet, or stick-pack filling" },
  { value: "bottle", label: "Bottle, tub, cup, or container filling" },
  { value: "carton", label: "Cartoning, sleeving, or case packing" },
  { value: "label", label: "Labelling, lidding, coding, or sleeving" },
  { value: "bundle", label: "Multipack, kitting, bundling, or gift packs" },
  { value: "display", label: "Retail display or promotional build" },
  { value: "rework", label: "Rework, inspection, relabelling, or repacking" },
  { value: "sample", label: "Samples, trial packs, or short-run launch packs" },
  { value: "cold", label: "Cold-fill, chilled, or temperature-sensitive packing" },
  { value: "customLine", label: "Custom line build or machinery-sourced project" },
  { value: "other", label: "Other co-packaging requirement" },
];

const tabs = ["Intake", "Internal review", "Customer return"] as const;
const baseStages: IntakeStage[] = ["contact", "product", "review"];
const stageMeta: Record<IntakeStage, { title: string; description: string }> = {
  contact: { title: "Contact", description: "Create a return reference so enterprise customers can leave and continue later." },
  product: { title: "Product basics", description: "Share enough product context for Pakco to choose the right follow-up path." },
  documents: { title: "Enterprise documents", description: "Upload specs, artwork, packaging drawings, NDA files, or any supporting file." },
  extraction: { title: "Assisted extraction", description: "Review draft fields created from the uploaded document context." },
  details: { title: "Detailed requirements", description: "Confirm product, packaging, QA, preparation, and sourcing responsibilities." },
  nda: { title: "NDA", description: "Choose Pakco NDA or upload a mutual NDA for Pakco to review." },
  review: { title: "Review", description: "Confirm the customer-visible information before internal triage begins." },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Intake");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EnquiryInput>(emptyForm);
  const [draft, setDraft] = useState<Enquiry | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [lookup, setLookup] = useState({ reference: "", email: "" });
  const [lookupResult, setLookupResult] = useState<Enquiry | null>(null);

  const selected = useMemo(() => enquiries.find((item) => item.id === selectedId) || enquiries[0], [enquiries, selectedId]);
  const stages = draft?.customerFlow.stages?.length ? draft.customerFlow.stages : baseStages;
  const currentStage = stages[Math.min(step, stages.length - 1)];
  const submitted = enquiries.filter((item) => item.state === "submitted");

  useEffect(() => {
    refreshEnquiries();
  }, []);

  async function refreshEnquiries() {
    const response = await fetch("/api/enquiries", { cache: "no-store" });
    const payload = (await response.json()) as { enquiries: Enquiry[] };
    setEnquiries(payload.enquiries);
    if (!selectedId && payload.enquiries[0]) setSelectedId(payload.enquiries[0].id);
  }

  function setField<K extends keyof EnquiryInput>(key: K, value: EnquiryInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function syncFromEnquiry(enquiry: Enquiry) {
    setDraft(enquiry);
    setForm(enquiry.data);
  }

  async function createDraft() {
    if (!form.company.trim() || !form.email.trim()) {
      setError("Company and email are required before Pakco can issue a return reference.");
      return;
    }
    setBusy("draft");
    setError("");
    const response = await fetch("/api/enquiries/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: form.company, email: form.email, contactName: form.contactName }),
    });
    const payload = (await response.json()) as { enquiry?: Enquiry; error?: string };
    setBusy("");
    if (!response.ok || !payload.enquiry) {
      setError(payload.error || "Could not create draft.");
      return;
    }
    syncFromEnquiry(payload.enquiry);
    setStatus(`Return reference ${payload.enquiry.reference} created and prototype email send recorded.`);
    setStep(1);
    await refreshEnquiries();
  }

  async function saveStage(next = true) {
    if (!draft) return createDraft();
    setBusy("save");
    setError("");
    const response = await fetch(`/api/enquiries/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: form, currentStage }),
    });
    const payload = (await response.json()) as { enquiry?: Enquiry; error?: string };
    setBusy("");
    if (!response.ok || !payload.enquiry) {
      setError(payload.error || "Could not save stage.");
      return;
    }
    syncFromEnquiry(payload.enquiry);
    setStatus(`${stageMeta[currentStage].title} saved.`);
    if (next) setStep((value) => Math.min(value + 1, payload.enquiry!.customerFlow.stages.length - 1));
    await refreshEnquiries();
  }

  async function uploadFiles() {
    if (!draft || !files.length) return saveStage();
    setBusy("files");
    setError("");
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    const response = await fetch(`/api/enquiries/${draft.id}/files`, { method: "POST", body });
    const payload = (await response.json()) as { enquiry?: Enquiry; error?: string };
    setBusy("");
    if (!response.ok || !payload.enquiry) {
      setError(payload.error || "Could not upload files.");
      return;
    }
    setFiles([]);
    syncFromEnquiry(payload.enquiry);
    setStatus(`${payload.enquiry.uploadedFiles.length} file record${payload.enquiry.uploadedFiles.length === 1 ? "" : "s"} saved.`);
    setStep((value) => Math.min(value + 1, payload.enquiry!.customerFlow.stages.length - 1));
    await refreshEnquiries();
  }

  async function extractFields() {
    if (!draft) return;
    setBusy("extract");
    setError("");
    const response = await fetch(`/api/enquiries/${draft.id}/extract`, { method: "POST" });
    const payload = (await response.json()) as { enquiry?: Enquiry; error?: string };
    setBusy("");
    if (!response.ok || !payload.enquiry) {
      setError(payload.error || "Could not generate assisted extraction.");
      return;
    }
    syncFromEnquiry(payload.enquiry);
    setStatus("Assisted draft fields generated. Please confirm or edit them.");
    setStep((value) => Math.min(value + 1, payload.enquiry!.customerFlow.stages.length - 1));
  }

  async function finalSubmit() {
    if (!draft) return;
    await saveStage(false);
    setBusy("submit");
    setError("");
    const response = await fetch(`/api/enquiries/${draft.id}/submit`, { method: "POST" });
    const payload = (await response.json()) as { enquiry?: Enquiry; error?: string };
    setBusy("");
    if (!response.ok || !payload.enquiry) {
      setError(payload.error || "Could not submit enquiry.");
      return;
    }
    syncFromEnquiry(payload.enquiry);
    setSelectedId(payload.enquiry.id);
    setStatus(`${payload.enquiry.reference} submitted. Internal users can review full triage now.`);
    setActiveTab("Internal review");
    await refreshEnquiries();
  }

  async function recordDecision(id: string, decision: string) {
    const response = await fetch(`/api/enquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const payload = (await response.json()) as { enquiries?: Enquiry[]; error?: string };
    if (!response.ok || !payload.enquiries) {
      setError(payload.error || "Could not save decision.");
      return;
    }
    setEnquiries(payload.enquiries);
    setStatus(`${decision} saved to the audit trail.`);
  }

  async function lookupDraft() {
    const params = new URLSearchParams({ reference: lookup.reference, email: lookup.email });
    const response = await fetch(`/api/enquiries?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as { enquiries: Enquiry[] };
    const found = payload.enquiries[0] || null;
    setLookupResult(found);
    if (found) {
      syncFromEnquiry(found);
      setStep(Math.max(0, found.customerFlow.stages.indexOf(found.currentStage)));
      setActiveTab("Intake");
      setStatus(`${found.reference} loaded. Continue from ${stageMeta[found.currentStage]?.title || "your current stage"}.`);
    } else {
      setError("No enquiry found for that reference and email.");
    }
  }

  function loadDemo(kind: "enterprise" | "machinery") {
    setForm({
      ...emptyForm,
      company: kind === "enterprise" ? "Colesworth Pantry Co" : "National Frozen Treats",
      contactName: kind === "enterprise" ? "Mira Chen" : "Daniel Wright",
      email: kind === "enterprise" ? "procurement@pantry.example" : "innovation@frozen.example",
      productType: kind === "enterprise" ? "hotfill" : "customLine",
      runVolume: kind === "enterprise" ? 120000 : 90000,
      frequency: "monthly",
      productStage: kind === "enterprise" ? "repeat" : "pilot",
      urgency: kind === "enterprise" ? "urgent" : "standard",
      notes: kind === "enterprise" ? "Hot-fill jarring, labelling, and carton packing for enterprise retail distribution." : "Large icy pole opportunity. Specs are developing and equipment may need sourcing.",
      hasPrimaryPackaging: true,
      hasSecondaryPackaging: kind === "enterprise",
      hasProductSpecs: true,
      hasAllergens: kind === "enterprise",
      hasSpecSheet: kind === "enterprise",
      ndaOption: "pakco",
    });
  }

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <Metric label="Total requests" value={enquiries.length.toString()} tone="bg-limewash" />
          <Metric label="Submitted" value={submitted.length.toString()} tone="bg-skyglass" />
          <Metric label="Drafts" value={enquiries.filter((item) => item.state === "draft").length.toString()} tone="bg-[#fff1cf]" />
          <Metric label="Enterprise" value={submitted.filter((item) => item.score.band === "Enterprise").length.toString()} tone="bg-[#ffe1d7]" />
        </section>

        {(status || error) && (
          <div className={`mb-5 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm ring-1 ${error ? "bg-[#ffe1d7] text-[#7d2717] ring-coral/30" : "bg-limewash text-kelp ring-moss/20"}`}>
            {error || status}
          </div>
        )}

        {activeTab === "Intake" && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
            <form className="card p-5 sm:p-7" onSubmit={(event) => event.preventDefault()}>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-coral">Enterprise enquiry</p>
                  <h2 className="font-display text-3xl font-black tracking-[-0.035em] sm:text-4xl">Tell us about your product.</h2>
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-ink/70">
                    Save contact details first, receive a return reference, then Pakco asks only for the next details this opportunity needs.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="secondary-button" type="button" onClick={() => loadDemo("enterprise")}>Ready product</button>
                  <button className="secondary-button" type="button" onClick={() => loadDemo("machinery")}>New line</button>
                </div>
              </div>

              <StageStepper stages={stages} current={step} onSelect={setStep} />
              {draft && (
                <div className="mt-4 rounded-2xl bg-limewash p-4 text-sm font-bold text-kelp ring-1 ring-moss/20">
                  Return reference: <span className="font-mono">{draft.reference}</span>. Prototype email send has been recorded.
                </div>
              )}
              {draft?.customerFlow.customerMessage && (
                <div className="mt-4 rounded-2xl bg-skyglass p-4 text-sm font-bold leading-6 text-ink/75 ring-1 ring-ink/10">
                  {draft.customerFlow.customerMessage}
                </div>
              )}

              <div className="mt-5 rounded-[1.5rem] bg-white/65 p-4 ring-1 ring-ink/10 sm:p-5">
                <StageBody
                  stage={currentStage}
                  form={form}
                  setField={setField}
                  files={files}
                  setFiles={setFiles}
                  draft={draft}
                />
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl text-sm font-medium leading-6 text-ink/70">
                  Customers never see score thresholds. Internal users see the full triage after final submission.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button" disabled={step === 0} type="button" onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</button>
                  {currentStage === "contact" && <button className="primary-button" disabled={busy === "draft"} type="button" onClick={createDraft}>{busy === "draft" ? "Creating..." : "Save contact and get reference"}</button>}
                  {currentStage === "documents" && <button className="primary-button" disabled={busy === "files"} type="button" onClick={uploadFiles}>{busy === "files" ? "Uploading..." : "Save files"}</button>}
                  {currentStage === "extraction" && <button className="primary-button" disabled={busy === "extract"} type="button" onClick={extractFields}>{busy === "extract" ? "Drafting..." : "Generate assisted draft"}</button>}
                  {currentStage !== "contact" && currentStage !== "documents" && currentStage !== "extraction" && currentStage !== "review" && (
                    <button className="primary-button" disabled={busy === "save"} type="button" onClick={() => saveStage()}>{busy === "save" ? "Saving..." : `Continue to ${stageMeta[stages[Math.min(step + 1, stages.length - 1)]].title}`}</button>
                  )}
                  {currentStage === "review" && <button className="primary-button" disabled={!draft || busy === "submit"} type="button" onClick={finalSubmit}>{busy === "submit" ? "Submitting..." : "Submit for internal review"}</button>}
                </div>
              </div>
            </form>

            <aside className="space-y-5">
              <div className="rounded-[1.75rem] bg-ink p-5 text-white shadow-color">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-marigold">Dynamic path</p>
                <h3 className="mt-3 font-display text-2xl font-black tracking-[-0.03em]">Triage changes what comes next.</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-white/75">After Product basics, the server decides whether this needs enterprise specs, machinery details, NDA, or a simpler review.</p>
              </div>
              <div className="card p-5">
                <h3 className="text-lg font-black">Recent requests</h3>
                <div className="mt-4 space-y-3">
                  {enquiries.slice(0, 4).map((item) => (
                    <QueueMini key={item.id} enquiry={item} onClick={() => { setSelectedId(item.id); setActiveTab("Internal review"); }} />
                  ))}
                  {!enquiries.length && <p className="rounded-2xl bg-limewash p-4 text-sm font-bold text-kelp">Create a draft to populate internal review.</p>}
                </div>
              </div>
            </aside>
          </section>
        )}

        {activeTab === "Internal review" && (
          <InternalReview enquiries={enquiries} selected={selected} selectedId={selectedId} setSelectedId={setSelectedId} refreshEnquiries={refreshEnquiries} recordDecision={recordDecision} />
        )}

        {activeTab === "Customer return" && (
          <CustomerReturn lookup={lookup} setLookup={setLookup} lookupResult={lookupResult} lookupDraft={lookupDraft} />
        )}
      </section>
    </main>
  );
}

function Header({ activeTab, setActiveTab }: { activeTab: (typeof tabs)[number]; setActiveTab: (tab: (typeof tabs)[number]) => void }) {
  return (
    <header className="mb-6 grid gap-5 rounded-[2rem] bg-white/60 p-4 shadow-lift ring-1 ring-ink/10 backdrop-blur-xl lg:grid-cols-[1.2fr_auto] lg:items-center">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-moss via-kelp to-coral font-mono text-xl font-black text-white shadow-color">PQ</div>
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-moss">Pakco QuoteFlow</p>
          <h1 className="font-display text-3xl font-black tracking-[-0.04em] text-ink sm:text-5xl">Tell us about your product and enterprise opportunity.</h1>
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 rounded-2xl bg-ink p-1.5" aria-label="QuoteFlow views">
        {tabs.map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === tab ? "bg-marigold text-ink shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{tab}</button>
        ))}
      </nav>
    </header>
  );
}

function StageBody({ stage, form, setField, files, setFiles, draft }: { stage: IntakeStage; form: EnquiryInput; setField: <K extends keyof EnquiryInput>(key: K, value: EnquiryInput[K]) => void; files: File[]; setFiles: (files: File[]) => void; draft: Enquiry | null }) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-moss">Current stage</p>
          <h3 className="mt-1 text-2xl font-black tracking-[-0.03em]">{stageMeta[stage].title}</h3>
        </div>
        <p className="max-w-sm text-sm font-semibold leading-6 text-ink/70">{stageMeta[stage].description}</p>
      </div>
      {stage === "contact" && <ContactFields form={form} setField={setField} />}
      {stage === "product" && <ProductFields form={form} setField={setField} />}
      {stage === "documents" && <DocumentFields draft={draft} files={files} setFiles={setFiles} />}
      {stage === "extraction" && <ExtractionFields draft={draft} form={form} setField={setField} />}
      {stage === "details" && <DetailFields form={form} setField={setField} />}
      {stage === "nda" && <NdaFields form={form} setField={setField} />}
      {stage === "review" && <ReviewStage draft={draft} form={form} />}
    </div>
  );
}

function ContactFields({ form, setField }: FormProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="field">Company<input className="control" required value={form.company} onChange={(event) => setField("company", event.target.value)} placeholder="National Foods Co" /></label>
      <label className="field">Contact name<input className="control" value={form.contactName} onChange={(event) => setField("contactName", event.target.value)} placeholder="Mira Chen" /></label>
      <label className="field md:col-span-2">Contact email<input className="control" required type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} placeholder="procurement@company.com" /></label>
    </div>
  );
}

function ProductFields({ form, setField }: FormProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="field md:col-span-2">Job type<select className="control" value={form.productType} onChange={(event) => setField("productType", event.target.value as ProductType)}>{productOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="field">Product stage<select className="control" value={form.productStage} onChange={(event) => setField("productStage", event.target.value as EnquiryInput["productStage"])}><option value="unknown">Not sure yet</option><option value="concept">Concept / trial</option><option value="pilot">Pilot run</option><option value="ready">Ready for production</option><option value="repeat">Repeat production program</option></select></label>
      <label className="field">Preferred timing<select className="control" value={form.urgency} onChange={(event) => setField("urgency", event.target.value as EnquiryInput["urgency"])}><option value="flexible">Flexible</option><option value="standard">Within 1-3 months</option><option value="urgent">As soon as possible</option></select></label>
      <label className="field">Units per run<input className="control" min={0} step={1000} type="number" value={form.runVolume || ""} onChange={(event) => setField("runVolume", Number(event.target.value))} placeholder="50000" /></label>
      <label className="field">Repeat frequency<select className="control" value={form.frequency} onChange={(event) => setField("frequency", event.target.value as EnquiryInput["frequency"])}><option value="unknown">Not sure yet</option><option value="once">One-off run</option><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option><option value="fortnightly">Fortnightly</option><option value="weekly">Weekly</option></select></label>
      <label className="field md:col-span-2">Product and packaging brief<textarea className="textarea" value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Example: hot-fill sauce into glass jars, with labelling and carton packing." /></label>
    </div>
  );
}

function DocumentFields({ draft, files, setFiles }: { draft: Enquiry | null; files: File[]; setFiles: (files: File[]) => void }) {
  return (
    <div className="grid gap-4">
      <label className="field">Upload enterprise documents<input className="control h-auto py-3" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label>
      <p className="rounded-2xl bg-limewash p-4 text-sm font-bold leading-6 text-kelp">Any file type is accepted for this prototype. Files are stored against the draft and used to create editable assisted fields.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {files.map((file) => <FileCard key={`${file.name}-${file.size}`} name={file.name} detail={`${Math.round(file.size / 1024)} KB selected`} />)}
        {draft?.uploadedFiles.map((file) => <FileCard key={file.id} name={file.originalName} detail={`${Math.round(file.size / 1024)} KB uploaded`} />)}
      </div>
    </div>
  );
}

function ExtractionFields({ draft, form, setField }: { draft: Enquiry | null } & FormProps) {
  const hasFields = Boolean(draft?.extractedFields.length);
  return (
    <div className="grid gap-4">
      <p className="rounded-2xl bg-skyglass p-4 text-sm font-bold leading-6 text-ink/75">Assisted extraction creates draft fields only. Customers must edit or confirm them before final submission.</p>
      {!hasFields && <p className="rounded-2xl bg-white/70 p-4 text-sm font-bold text-ink/60 ring-1 ring-ink/10">No assisted fields yet. Use the button below to generate drafts from uploaded document context.</p>}
      {hasFields && <DetailFields form={form} setField={setField} />}
      {hasFields && <Checkbox label="I have reviewed and confirmed these assisted draft fields" checked={form.extractionConfirmed} onChange={(checked) => setField("extractionConfirmed", checked)} />}
    </div>
  );
}

function DetailFields({ form, setField }: FormProps) {
  return (
    <div className="grid gap-4">
      <label className="field">Product details<textarea className="textarea" value={form.productDetails} onChange={(event) => setField("productDetails", event.target.value)} placeholder="Product, ingredients, fill/pack process, handling requirements." /></label>
      <label className="field">Package format<textarea className="textarea" value={form.packageFormat} onChange={(event) => setField("packageFormat", event.target.value)} placeholder="Jar, pouch, carton, label, closure, shipper, display, or other pack format." /></label>
      <label className="field">Packaging design or technical documents<textarea className="textarea" value={form.packagingDesign} onChange={(event) => setField("packagingDesign", event.target.value)} placeholder="Artwork, dielines, technical drawings, tolerances, packaging specs." /></label>
      <label className="field">Onsite preparation required from Pakco<textarea className="textarea" value={form.onsitePreparation} onChange={(event) => setField("onsitePreparation", event.target.value)} placeholder="Mixing, batching, heating, chilling, filling, coding, QA checks, storage." /></label>
      <label className="field">QA-sensitive considerations<textarea className="textarea" value={form.qaConsiderations} onChange={(event) => setField("qaConsiderations", event.target.value)} placeholder="Allergens, shelf-life, temperature, ingredient handling, traceability, contamination risks." /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">Free-issued items<textarea className="textarea" value={form.freeIssuedItems} onChange={(event) => setField("freeIssuedItems", event.target.value)} placeholder="Customer-supplied ingredients, packaging materials, labels, cartons." /></label>
        <label className="field">Pakco-sourced items<textarea className="textarea" value={form.pakcoSourcedItems} onChange={(event) => setField("pakcoSourcedItems", event.target.value)} placeholder="Items Pakco needs to source, cost, procure, or validate." /></label>
      </div>
    </div>
  );
}

function NdaFields({ form, setField }: FormProps) {
  return (
    <div className="grid gap-4">
      <label className="field">NDA preference<select className="control" value={form.ndaOption} onChange={(event) => setField("ndaOption", event.target.value as EnquiryInput["ndaOption"])}><option value="none">No NDA requested</option><option value="pakco">Request Pakco NDA</option><option value="customer">We will upload our mutual NDA for Pakco to sign</option></select></label>
      <p className="rounded-2xl bg-limewash p-4 text-sm font-bold leading-6 text-kelp">If a mutual NDA is needed, upload it in Enterprise documents. This stage records the preference and keeps NDA visible to internal reviewers.</p>
    </div>
  );
}

function ReviewStage({ draft, form }: { draft: Enquiry | null; form: EnquiryInput }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ReviewItem label="Reference" value={draft?.reference || "Created after contact"} />
      <ReviewItem label="Company" value={form.company || "Not supplied"} />
      <ReviewItem label="Job type" value={productOptions.find((option) => option.value === form.productType)?.label || "Other"} />
      <ReviewItem label="Run volume" value={form.runVolume ? `${form.runVolume.toLocaleString("en-AU")} units` : "To confirm"} />
      <ReviewItem label="NDA" value={form.ndaOption} />
      <ReviewItem label="Documents" value={`${draft?.uploadedFiles.length || 0} uploaded`} />
      <div className="rounded-2xl bg-limewash p-4 ring-1 ring-moss/15 lg:col-span-2">
        <p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-moss">What happens next</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-kelp/80">Pakco will score and route this internally. Customers will not see the scoring thresholds or internal reasons.</p>
      </div>
    </div>
  );
}

function InternalReview({ enquiries, selected, selectedId, setSelectedId, refreshEnquiries, recordDecision }: { enquiries: Enquiry[]; selected?: Enquiry; selectedId: string; setSelectedId: (id: string) => void; refreshEnquiries: () => void; recordDecision: (id: string, decision: string) => void }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
      <aside className="card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-moss">Queue</p><h2 className="text-2xl font-black tracking-[-0.03em]">Internal review</h2></div>
          <button className="secondary-button px-3" type="button" onClick={refreshEnquiries}>Refresh</button>
        </div>
        <div className="space-y-3">
          {enquiries.map((item) => <QueueCard key={item.id} enquiry={item} active={selectedId === item.id} onClick={() => setSelectedId(item.id)} />)}
          {!enquiries.length && <p className="rounded-2xl bg-white/70 p-5 text-sm font-bold text-ink/60 ring-1 ring-ink/10">No requests yet.</p>}
        </div>
      </aside>
      <section className="card overflow-hidden">
        {selected ? <InternalDetail enquiry={selected} recordDecision={recordDecision} /> : <div className="p-8 text-center"><h2 className="text-3xl font-black">No enquiry selected</h2></div>}
      </section>
    </section>
  );
}

function InternalDetail({ enquiry, recordDecision }: { enquiry: Enquiry; recordDecision: (id: string, decision: string) => void }) {
  return (
    <div>
      <div className="bg-gradient-to-br from-limewash via-skyglass to-[#ffe1d7] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-kelp">{enquiry.reference} · {enquiry.state}</p>
            <h2 className="mt-2 font-display text-4xl font-black tracking-[-0.045em]">{enquiry.data.company}</h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-ink/70">{enquiry.customerFlow.customerMessage}</p>
          </div>
          <div className="rounded-3xl bg-white/75 p-5 text-center shadow-lift ring-1 ring-ink/10">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-moss">Internal score</p>
            <p className="mt-1 font-display text-6xl font-black tracking-[-0.06em]">{enquiry.score.total}</p>
            <Band band={enquiry.score.band} />
          </div>
        </div>
      </div>
      <div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[1fr_0.85fr]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">{Object.entries(enquiry.score.pillars).map(([label, value]) => <ScoreBar key={label} label={label} value={value} />)}</div>
          <Panel title="Internal triage logic"><ul className="space-y-3">{[...enquiry.score.reasoning, ...enquiry.customerFlow.internalReasons].map((reason) => <li key={reason} className="rounded-2xl bg-white/70 p-3 text-sm font-semibold leading-6 text-ink/70 ring-1 ring-ink/10">{reason}</li>)}</ul></Panel>
          <Panel title="Human approval"><div className="flex flex-wrap gap-2">{["Approved recommendation", "Sent to growth nurture", "Escalated to CEO roundtable", "Decline approved"].map((decision) => <button key={decision} type="button" onClick={() => recordDecision(enquiry.id, decision)} className="secondary-button">{decision.replace(" recommendation", "")}</button>)}</div></Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Dynamic customer flow"><div className="space-y-2">{enquiry.customerFlow.stages.map((stage) => <div key={stage} className="rounded-xl bg-limewash px-3 py-2 text-sm font-black text-kelp">{stageMeta[stage].title}</div>)}</div></Panel>
          <Panel title="Detailed requirements"><ul className="space-y-2 text-sm font-semibold text-ink/70"><li>Product: {enquiry.data.productDetails || "Missing"}</li><li>Package: {enquiry.data.packageFormat || "Missing"}</li><li>Free-issued: {enquiry.data.freeIssuedItems || "Missing"}</li><li>Pakco-sourced: {enquiry.data.pakcoSourcedItems || "Missing"}</li></ul></Panel>
          <Panel title="Uploaded files"><div className="space-y-2">{enquiry.uploadedFiles.length ? enquiry.uploadedFiles.map((file) => <FileCard key={file.id} name={file.originalName} detail={file.mimeType} />) : <p className="text-sm font-bold text-ink/55">No files uploaded.</p>}</div></Panel>
          <Panel title="Audit trail"><ul className="space-y-2 text-sm font-semibold text-ink/65">{enquiry.audit.map((item) => <li key={item}>{item}</li>)}</ul></Panel>
        </div>
      </div>
    </div>
  );
}

function CustomerReturn({ lookup, setLookup, lookupResult, lookupDraft }: { lookup: { reference: string; email: string }; setLookup: (value: { reference: string; email: string }) => void; lookupResult: Enquiry | null; lookupDraft: () => void }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[0.75fr_1fr]">
      <div className="card p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-coral">Return link</p>
        <h2 className="mt-2 font-display text-3xl font-black tracking-[-0.035em]">Continue with your reference.</h2>
        <div className="mt-5 grid gap-4">
          <label className="field">Reference<input className="control" value={lookup.reference} onChange={(event) => setLookup({ ...lookup, reference: event.target.value })} placeholder="PKQ-2026-0001" /></label>
          <label className="field">Contact email<input className="control" type="email" value={lookup.email} onChange={(event) => setLookup({ ...lookup, email: event.target.value })} placeholder="procurement@company.com" /></label>
          <button className="primary-button" type="button" onClick={lookupDraft}>Continue enquiry</button>
        </div>
      </div>
      <div className="card p-6">
        {lookupResult ? <ReviewStage draft={lookupResult} form={lookupResult.data} /> : <div className="grid min-h-72 place-items-center rounded-[1.5rem] bg-limewash p-8 text-center"><div><h3 className="text-2xl font-black">Enter a reference and email.</h3><p className="mt-2 text-sm font-semibold leading-6 text-kelp/75">Customers can continue without seeing internal score logic.</p></div></div>}
      </div>
    </section>
  );
}

type FormProps = {
  form: EnquiryInput;
  setField: <K extends keyof EnquiryInput>(key: K, value: EnquiryInput[K]) => void;
};

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className={`${tone} rounded-3xl p-5 shadow-sm ring-1 ring-ink/10`}><p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-ink/60">{label}</p><p className="mt-2 font-display text-4xl font-black tracking-[-0.05em]">{value}</p></div>;
}

function StageStepper({ stages, current, onSelect }: { stages: IntakeStage[]; current: number; onSelect: (step: number) => void }) {
  return (
    <ol className="grid gap-3 md:grid-cols-3 xl:grid-cols-7" aria-label="Enquiry stages">
      {stages.map((stage, index) => {
        const active = index === current;
        const complete = index < current;
        return (
          <li key={stage}>
            <button type="button" onClick={() => onSelect(index)} className={`flex min-h-24 w-full flex-col justify-between rounded-2xl p-4 text-left ring-1 transition hover:-translate-y-0.5 ${active ? "bg-ink text-white shadow-color ring-ink" : complete ? "bg-limewash text-kelp ring-moss/20" : "bg-white/70 text-ink ring-ink/10 hover:bg-skyglass"}`} aria-current={active ? "step" : undefined}>
              <span className="flex items-center justify-between gap-3"><span className={`grid h-8 w-8 place-items-center rounded-xl font-mono text-sm font-black ${active ? "bg-marigold text-ink" : complete ? "bg-moss text-white" : "bg-ink/10 text-ink"}`}>{index + 1}</span><span className={`font-mono text-[10px] font-black uppercase tracking-[0.16em] ${active ? "text-white/60" : "text-ink/45"}`}>{complete ? "Done" : active ? "Now" : "Next"}</span></span>
              <span className="mt-3 text-sm font-black">{stageMeta[stage].title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-12 items-center gap-3 rounded-xl bg-white/70 px-3 text-sm font-bold text-ink/75 ring-1 ring-ink/10 transition hover:bg-limewash"><input className="h-4 w-4 accent-coral" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/75 p-4 ring-1 ring-ink/10"><p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-ink/45">{label}</p><p className="mt-2 text-lg font-black tracking-[-0.02em] text-ink">{value}</p></div>;
}

function QueueMini({ enquiry, onClick }: { enquiry: Enquiry; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="w-full rounded-2xl bg-white/70 p-4 text-left ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:bg-skyglass"><div className="flex items-center justify-between gap-3"><div><p className="font-black">{enquiry.data.company}</p><p className="mt-1 font-mono text-xs font-bold text-ink/45">{enquiry.reference} · {enquiry.state}</p></div><Band band={enquiry.score.band} /></div></button>;
}

function QueueCard({ enquiry, active, onClick }: { enquiry: Enquiry; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`w-full rounded-2xl p-4 text-left transition hover:-translate-y-0.5 ${active ? "bg-ink text-white shadow-color" : "bg-white/70 ring-1 ring-ink/10 hover:bg-limewash"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{enquiry.data.company}</h3><p className={`mt-1 font-mono text-xs ${active ? "text-white/60" : "text-ink/50"}`}>{enquiry.reference} · {enquiry.state}</p></div><Band band={enquiry.score.band} /></div><p className={`mt-3 text-sm font-bold ${active ? "text-white/80" : "text-ink/70"}`}>{enquiry.score.total}/100 score · {enquiry.customerFlow.path}</p></button>;
}

function Band({ band }: { band: Enquiry["score"]["band"] }) {
  const className = band === "Enterprise" ? "bg-kelp text-white" : band === "Growth" ? "bg-marigold text-ink" : "bg-[#ffe1d7] text-[#7d2717]";
  return <span className={`inline-flex rounded-xl px-3 py-1.5 text-xs font-black ${className}`}>{band}</span>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="soft-card p-4"><h3 className="mb-3 text-base font-black">{title}</h3>{children}</section>;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-ink/10"><div className="mb-3 flex items-center justify-between gap-4"><p className="font-black capitalize">{label}</p><p className="font-mono text-sm font-black">{value}</p></div><div className="h-3 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-gradient-to-r from-moss via-marigold to-coral" style={{ width: `${value}%` }} /></div></div>;
}

function FileCard({ name, detail }: { name: string; detail: string }) {
  return <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-ink/10"><p className="break-words text-sm font-black">{name}</p><p className="mt-1 text-xs font-bold text-ink/50">{detail}</p></div>;
}
