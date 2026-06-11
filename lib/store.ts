import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeInput, scoreEnquiry, triageCustomerFlow } from "./scoring";
import type { AuditEvent, Enquiry, EnquiryInput, ExtractedField, IntakeStage, UploadedFile } from "./types";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "quoteflow.sqlite");
export const uploadsDir = path.join(dataDir, "uploads");

type EnquiryRow = {
  id: string;
  reference: string;
  state: "draft" | "submitted";
  current_stage: IntakeStage;
  data_json: string;
  score_json: string;
  customer_flow_json: string;
  nda_state: string;
  missing_tasks_json: string;
  role_tasks_json: string;
  decisions_json: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  revision: number;
};

let initialized = false;

export async function readEnquiries() {
  ensureDb();
  const rows = query<EnquiryRow>("select * from enquiries order by created_at desc");
  return rows.map(hydrateEnquiry);
}

export async function readEnquiry(id: string) {
  ensureDb();
  const rows = query<EnquiryRow>(`select * from enquiries where id = ${sqlValue(id)} limit 1`);
  return rows[0] ? hydrateEnquiry(rows[0]) : null;
}

export async function findEnquiryByReference(reference: string, email: string) {
  ensureDb();
  const rows = query<EnquiryRow>(
    `select * from enquiries where lower(reference) = lower(${sqlValue(reference)}) and lower(json_extract(data_json, '$.email')) = lower(${sqlValue(email)}) limit 1`,
  );
  return rows[0] ? hydrateEnquiry(rows[0]) : null;
}

export async function createDraft(input: Partial<EnquiryInput>) {
  ensureDb();
  const now = new Date().toISOString();
  const count = query<{ count: number }>("select count(*) as count from enquiries")[0]?.count || 0;
  const reference = `PKQ-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  const data = normalizeInput(input);
  const score = scoreEnquiry(data);
  const customerFlow = triageCustomerFlow(data, score);
  const id = crypto.randomUUID();

  run(`insert into enquiries (
    id, reference, state, current_stage, data_json, score_json, customer_flow_json, nda_state,
    missing_tasks_json, role_tasks_json, decisions_json, created_at, updated_at, submitted_at, revision
  ) values (
    ${sqlValue(id)}, ${sqlValue(reference)}, 'draft', 'product', ${jsonValue(data)}, ${jsonValue(score)}, ${jsonValue(customerFlow)}, ${sqlValue(getNdaState(data))},
    ${jsonValue(missingTasksFor(data))}, ${jsonValue(roleTasksFor(score))}, ${jsonValue([])}, ${sqlValue(now)}, ${sqlValue(now)}, null, 1
  )`);
  addAudit(id, "Draft enquiry created from contact details", now);
  addAudit(id, `Return reference ${reference} issued; prototype email send recorded`, now);
  return readEnquiry(id);
}

export async function updateEnquiry(id: string, patch: Partial<EnquiryInput>, currentStage?: IntakeStage) {
  const enquiry = await readEnquiry(id);
  if (!enquiry) return null;
  const data = normalizeInput({ ...enquiry.data, ...patch });
  const score = scoreEnquiry(data);
  const customerFlow = triageCustomerFlow(data, score);
  const now = new Date().toISOString();
  run(`update enquiries set
    current_stage = ${sqlValue(currentStage || enquiry.currentStage)},
    data_json = ${jsonValue(data)},
    score_json = ${jsonValue(score)},
    customer_flow_json = ${jsonValue(customerFlow)},
    nda_state = ${sqlValue(getNdaState(data))},
    missing_tasks_json = ${jsonValue(missingTasksFor(data))},
    role_tasks_json = ${jsonValue(roleTasksFor(score))},
    updated_at = ${sqlValue(now)}
    where id = ${sqlValue(id)}`);
  addAudit(id, `${stageLabel(currentStage || enquiry.currentStage)} stage saved`, now);
  return readEnquiry(id);
}

export async function addUploadedFile(enquiryId: string, file: { originalName: string; storedPath: string; mimeType: string; size: number }) {
  ensureDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  run(`insert into uploaded_files (id, enquiry_id, original_name, stored_path, mime_type, size, created_at)
    values (${sqlValue(id)}, ${sqlValue(enquiryId)}, ${sqlValue(file.originalName)}, ${sqlValue(file.storedPath)}, ${sqlValue(file.mimeType)}, ${file.size}, ${sqlValue(now)})`);
  addAudit(enquiryId, `Uploaded ${file.originalName}`, now);
  const enquiry = await readEnquiry(enquiryId);
  if (enquiry) {
    await updateEnquiry(enquiryId, {
      specDocumentsCount: enquiry.uploadedFiles.length + 1,
      productPhotosCount: enquiry.uploadedFiles.filter((item) => item.mimeType.startsWith("image/")).length + (file.mimeType.startsWith("image/") ? 1 : 0),
      ndaDocumentsCount: enquiry.data.ndaOption === "customer" ? enquiry.data.ndaDocumentsCount + 1 : enquiry.data.ndaDocumentsCount,
    }, "documents");
  }
  return readEnquiry(enquiryId);
}

export async function generateAssistedExtraction(enquiryId: string) {
  const enquiry = await readEnquiry(enquiryId);
  if (!enquiry) return null;
  const now = new Date().toISOString();
  const source = enquiry.uploadedFiles[0];
  const drafts: { fieldKey: keyof EnquiryInput; value: string }[] = [
    { fieldKey: "productDetails", value: enquiry.data.productDetails || guessFrom(enquiry, "Product details to confirm from uploaded enterprise documents.") },
    { fieldKey: "packageFormat", value: enquiry.data.packageFormat || guessFrom(enquiry, "Package format to confirm from drawings, packaging designs, or spec sheets.") },
    { fieldKey: "packagingDesign", value: enquiry.data.packagingDesign || "Drafted from uploaded packaging artwork/design files if supplied; customer to confirm." },
    { fieldKey: "onsitePreparation", value: enquiry.data.onsitePreparation || "Pakco to confirm onsite preparation, handling, batching, chilling, filling, or packing requirements." },
    { fieldKey: "qaConsiderations", value: enquiry.data.qaConsiderations || "QA to review allergens, ingredient handling, shelf-life, temperature control, and traceability requirements." },
    { fieldKey: "freeIssuedItems", value: enquiry.data.freeIssuedItems || "Customer to confirm ingredients, packaging materials, labels, cartons, or components supplied free issue." },
    { fieldKey: "pakcoSourcedItems", value: enquiry.data.pakcoSourcedItems || "Pakco to confirm ingredients, packaging, consumables, or machinery inputs it needs to source." },
  ];

  run(`delete from extracted_fields where enquiry_id = ${sqlValue(enquiryId)}`);
  drafts.forEach((draft) => {
    run(`insert into extracted_fields (id, enquiry_id, field_key, value, confidence, source_file_id, confirmed, created_at)
      values (${sqlValue(crypto.randomUUID())}, ${sqlValue(enquiryId)}, ${sqlValue(draft.fieldKey)}, ${sqlValue(draft.value)}, 'draft', ${sqlValue(source?.id || "")}, 0, ${sqlValue(now)})`);
  });

  addAudit(enquiryId, "Assisted extraction draft generated from uploaded files and enquiry context", now);
  await updateEnquiry(enquiryId, Object.fromEntries(drafts.map((draft) => [draft.fieldKey, draft.value])) as Partial<EnquiryInput>, "extraction");
  return readEnquiry(enquiryId);
}

export async function submitEnquiry(id: string) {
  const enquiry = await readEnquiry(id);
  if (!enquiry) return null;
  const now = new Date().toISOString();
  const data = normalizeInput({ ...enquiry.data, extractionConfirmed: true });
  const score = scoreEnquiry(data);
  const customerFlow = triageCustomerFlow(data, score);
  run(`update enquiries set
    state = 'submitted',
    current_stage = 'review',
    data_json = ${jsonValue(data)},
    score_json = ${jsonValue(score)},
    customer_flow_json = ${jsonValue(customerFlow)},
    nda_state = ${sqlValue(getNdaState(data))},
    missing_tasks_json = ${jsonValue(missingTasksFor(data))},
    role_tasks_json = ${jsonValue(roleTasksFor(score))},
    updated_at = ${sqlValue(now)},
    submitted_at = ${sqlValue(now)}
    where id = ${sqlValue(id)}`);
  addAudit(id, "Final enquiry submitted for internal review", now);
  addAudit(id, `${score.band} score generated for internal users`, now);
  return readEnquiry(id);
}

export async function recordDecision(id: string, decision: string) {
  const enquiry = await readEnquiry(id);
  if (!enquiry) return null;
  const now = new Date().toISOString();
  const decisions = [decision, ...enquiry.decisions];
  run(`update enquiries set decisions_json = ${jsonValue(decisions)}, updated_at = ${sqlValue(now)} where id = ${sqlValue(id)}`);
  addAudit(id, `Human decision: ${decision}`, now);
  return readEnquiries();
}

function hydrateEnquiry(row: EnquiryRow): Enquiry {
  const data = normalizeInput(parseJson(row.data_json, {}));
  const score = parseJson(row.score_json, scoreEnquiry(data));
  const customerFlow = parseJson(row.customer_flow_json, triageCustomerFlow(data, score));
  const uploadedFiles = query<UploadedFileRow>(`select * from uploaded_files where enquiry_id = ${sqlValue(row.id)} order by created_at asc`).map(mapFile);
  const extractedFields = query<ExtractedFieldRow>(`select * from extracted_fields where enquiry_id = ${sqlValue(row.id)} order by created_at asc`).map(mapExtractedField);
  const auditRows = query<AuditEventRow>(`select * from audit_events where enquiry_id = ${sqlValue(row.id)} order by created_at desc`).map(mapAudit);
  return {
    id: row.id,
    reference: row.reference,
    state: row.state,
    currentStage: row.current_stage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at || undefined,
    revision: row.revision,
    data,
    customerFlow,
    score,
    ndaState: row.nda_state,
    missingTasks: parseJson(row.missing_tasks_json, missingTasksFor(data)),
    roleTasks: parseJson(row.role_tasks_json, roleTasksFor(score)),
    decisions: parseJson(row.decisions_json, []),
    audit: auditRows.map((event) => event.message),
    uploadedFiles,
    extractedFields,
  };
}

function ensureDb() {
  if (initialized) return;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(uploadsDir, { recursive: true });
  run(`create table if not exists enquiries (
    id text primary key,
    reference text not null unique,
    state text not null,
    current_stage text not null,
    data_json text not null,
    score_json text not null,
    customer_flow_json text not null,
    nda_state text not null,
    missing_tasks_json text not null,
    role_tasks_json text not null,
    decisions_json text not null,
    created_at text not null,
    updated_at text not null,
    submitted_at text,
    revision integer not null default 1
  )`);
  run(`create table if not exists uploaded_files (
    id text primary key,
    enquiry_id text not null,
    original_name text not null,
    stored_path text not null,
    mime_type text not null,
    size integer not null,
    created_at text not null
  )`);
  run(`create table if not exists extracted_fields (
    id text primary key,
    enquiry_id text not null,
    field_key text not null,
    value text not null,
    confidence text not null,
    source_file_id text,
    confirmed integer not null default 0,
    created_at text not null
  )`);
  run(`create table if not exists audit_events (
    id text primary key,
    enquiry_id text not null,
    message text not null,
    created_at text not null
  )`);
  importLegacyJsonIfEmpty();
  initialized = true;
}

function importLegacyJsonIfEmpty() {
  const count = query<{ count: number }>("select count(*) as count from enquiries")[0]?.count || 0;
  if (count) return;
  try {
    const legacy = JSON.parse(readFileSync(path.join(dataDir, "enquiries.json"), "utf8")) as Enquiry[];
    legacy.forEach((item) => {
      const data = normalizeInput(item.data);
      const score = scoreEnquiry(data);
      const customerFlow = triageCustomerFlow(data, score);
      run(`insert into enquiries (
        id, reference, state, current_stage, data_json, score_json, customer_flow_json, nda_state,
        missing_tasks_json, role_tasks_json, decisions_json, created_at, updated_at, submitted_at, revision
      ) values (
        ${sqlValue(item.id)}, ${sqlValue(item.reference)}, ${sqlValue(item.state || "submitted")}, ${sqlValue(item.currentStage || "review")},
        ${jsonValue(data)}, ${jsonValue(score)}, ${jsonValue(customerFlow)}, ${sqlValue(item.ndaState || getNdaState(data))},
        ${jsonValue(item.missingTasks || missingTasksFor(data))}, ${jsonValue(item.roleTasks || roleTasksFor(score))}, ${jsonValue(item.decisions || [])},
        ${sqlValue(item.createdAt)}, ${sqlValue(item.updatedAt || item.createdAt)}, ${sqlValue(item.submittedAt || item.createdAt)}, ${item.revision || 1}
      )`);
      (item.audit || []).forEach((message) => addAudit(item.id, message, item.createdAt));
    });
  } catch {
    // No legacy file to import.
  }
}

function addAudit(enquiryId: string, message: string, createdAt = new Date().toISOString()) {
  run(`insert into audit_events (id, enquiry_id, message, created_at)
    values (${sqlValue(crypto.randomUUID())}, ${sqlValue(enquiryId)}, ${sqlValue(message)}, ${sqlValue(createdAt)})`);
}

function run(sql: string) {
  execFileSync("/usr/bin/sqlite3", [dbPath, sql], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
}

function query<T>(sql: string): T[] {
  const out = execFileSync("/usr/bin/sqlite3", ["-json", dbPath, sql], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  return out.trim() ? (JSON.parse(out) as T[]) : [];
}

function sqlValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonValue(value: unknown) {
  return sqlValue(JSON.stringify(value));
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getNdaState(data: EnquiryInput) {
  if (data.ndaOption === "customer" || data.ndaDocumentsCount > 0) return "Customer NDA uploaded";
  if (data.ndaOption === "pakco") return "Pakco NDA requested";
  return "Not requested";
}

function missingTasksFor(data: EnquiryInput) {
  return [
    !data.productDetails && "Describe the product and preparation requirements",
    !data.packageFormat && "Describe the package format",
    !data.freeIssuedItems && "Confirm free-issued items",
    !data.pakcoSourcedItems && "Confirm Pakco-sourced items",
    !data.extractionConfirmed && (data.specDocumentsCount || data.productPhotosCount) && "Confirm assisted extraction fields",
  ].filter((task): task is string => typeof task === "string" && task.length > 0);
}

function roleTasksFor(score: ReturnType<typeof scoreEnquiry>) {
  const tasks = [{ role: "Commercial", task: "Approve lead band and customer response", status: "Open" }];
  if (score.band !== "Reject") tasks.push({ role: "Production", task: "Confirm production fit and capacity assumptions", status: "Open" });
  if (score.internalAssumptions.capability === "machinery") {
    tasks.push({ role: "Engineering", task: "Assess sourced machinery and commissioning path", status: "Open" });
    tasks.push({ role: "Finance", task: "Validate machinery amortisation coverage", status: "Open" });
  } else if (score.band === "Enterprise") {
    tasks.push({ role: "Finance", task: "Validate MCV revenue assumptions", status: "Open" });
  }
  return tasks;
}

function guessFrom(enquiry: Enquiry, fallback: string) {
  const files = enquiry.uploadedFiles.map((file) => file.originalName).join(", ");
  return files ? `${fallback} Source files: ${files}.` : fallback;
}

function stageLabel(stage: IntakeStage) {
  return stage.replace(/^\w/, (char) => char.toUpperCase());
}

type UploadedFileRow = {
  id: string;
  enquiry_id: string;
  original_name: string;
  stored_path: string;
  mime_type: string;
  size: number;
  created_at: string;
};

type ExtractedFieldRow = {
  id: string;
  enquiry_id: string;
  field_key: keyof EnquiryInput;
  value: string;
  confidence: "draft" | "low" | "manual";
  source_file_id: string | null;
  confirmed: number;
  created_at: string;
};

type AuditEventRow = {
  id: string;
  enquiry_id: string;
  message: string;
  created_at: string;
};

function mapFile(row: UploadedFileRow): UploadedFile {
  return {
    id: row.id,
    enquiryId: row.enquiry_id,
    originalName: row.original_name,
    storedPath: row.stored_path,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
  };
}

function mapExtractedField(row: ExtractedFieldRow): ExtractedField {
  return {
    id: row.id,
    enquiryId: row.enquiry_id,
    fieldKey: row.field_key,
    value: row.value,
    confidence: row.confidence,
    sourceFileId: row.source_file_id || undefined,
    confirmed: Boolean(row.confirmed),
    createdAt: row.created_at,
  };
}

function mapAudit(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    enquiryId: row.enquiry_id,
    message: row.message,
    createdAt: row.created_at,
  };
}

export function saveUploadedBytes(enquiryId: string, fileName: string, bytes: Buffer) {
  mkdirSync(path.join(uploadsDir, enquiryId), { recursive: true });
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storedPath = path.join(uploadsDir, enquiryId, `${Date.now()}-${safe}`);
  writeFileSync(storedPath, bytes);
  return storedPath;
}
