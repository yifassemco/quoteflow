import type { CustomerFlow, Enquiry, EnquiryInput, ProductType, Score } from "./types";

const settings = {
  annualRevenueTarget: 250000,
  monthlyVolumeThreshold: 50000,
  minimumVolumeThreshold: 30000,
  internalRevenuePerUnit: 0.45,
  machineryLeadTime: "12-14 weeks before production",
  rejectThreshold: 45,
  enterpriseThreshold: 75,
  marketWeight: 25,
  commitmentWeight: 30,
  fitWeight: 25,
  readinessWeight: 20,
  jobTypeTargets: {
    hotfill: 250000,
    ambientLiquid: 250000,
    viscous: 275000,
    dryFill: 180000,
    pouch: 350000,
    bottle: 250000,
    carton: 160000,
    label: 120000,
    bundle: 140000,
    display: 150000,
    rework: 100000,
    sample: 80000,
    cold: 320000,
    customLine: 500000,
    other: 250000,
  } satisfies Record<ProductType, number>,
};

export function createEnquiry(input: EnquiryInput, count: number): Enquiry {
  const now = new Date();
  const clean = normalizeInput(input);
  const score = scoreEnquiry(clean);
  const customerFlow = triageCustomerFlow(clean, score);
  const reference = `PKQ-${now.getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  return {
    id: crypto.randomUUID(),
    reference,
    state: "submitted",
    currentStage: "review",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    submittedAt: now.toISOString(),
    revision: 1,
    data: clean,
    customerFlow,
    score,
    ndaState: getNdaState(clean),
    missingTasks: missingTasks(clean),
    roleTasks: roleTasks(score),
    decisions: [],
    audit: [`${formatDate(now)} enquiry submitted`, `${formatDate(now)} ${score.band} score generated`],
    uploadedFiles: [],
    extractedFields: [],
  };
}

export function rescore(enquiry: Enquiry): Enquiry {
  const score = scoreEnquiry(enquiry.data);
  const customerFlow = triageCustomerFlow(enquiry.data, score);
  return {
    ...enquiry,
    score,
    customerFlow,
    ndaState: getNdaState(enquiry.data),
    missingTasks: missingTasks(enquiry.data),
    roleTasks: roleTasks(score),
  };
}

export function scoreEnquiry(data: EnquiryInput): Score {
  const monthlyVolume = estimateMonthlyVolume(data);
  const minimumVolume = Math.round(monthlyVolume * valueMap(data.productStage, { unknown: 0, concept: 0.1, pilot: 0.25, ready: 0.55, repeat: 0.75 }));
  const unitRevenue = settings.internalRevenuePerUnit;
  const activeMonths = 12;
  const appliedAnnualTarget = settings.jobTypeTargets[data.productType] || settings.annualRevenueTarget;
  const estimatedAnnualValue = monthlyVolume * unitRevenue * activeMonths;
  const attachmentSignal = data.specDocumentsCount * 8 + data.productPhotosCount * 6;
  const market = clamp((data.company ? 16 : 0) + (isBusinessEmail(data.email) ? 18 : 4) + valueMap(data.productStage, { unknown: 8, concept: 12, pilot: 35, ready: 60, repeat: 78 }) + attachmentSignal);
  const commitment = clamp(
    scoreThreshold(monthlyVolume, settings.monthlyVolumeThreshold, 42) +
      scoreThreshold(minimumVolume, settings.minimumVolumeThreshold, 28) +
      scoreThreshold(estimatedAnnualValue, appliedAnnualTarget, 20) +
      valueMap(data.frequency, { unknown: 0, once: 4, quarterly: 10, monthly: 18, fortnightly: 24, weekly: 28 }),
  );
  const capability = inferCapability(data);
  const fit = clamp(valueMap(capability, { current: 90, adjacent: 76, machinery: 78, poor: 18 }) + valueMap(data.productType, {
    hotfill: 10,
    ambientLiquid: 9,
    viscous: 9,
    dryFill: 4,
    pouch: 2,
    bottle: 7,
    carton: 6,
    label: 8,
    bundle: 5,
    display: 5,
    rework: 5,
    sample: 3,
    cold: -2,
    customLine: 6,
    other: 0,
  }));
  const readinessChecks = [data.hasPrimaryPackaging, data.hasSecondaryPackaging, data.hasProductSpecs, data.hasAllergens, data.hasSpecSheet || data.specDocumentsCount > 0].filter(Boolean).length;
  const readiness = clamp(valueMap(data.productStage, { unknown: 12, concept: 20, pilot: 38, ready: 58, repeat: 68 }) + readinessChecks * 7 + Math.min(12, data.productPhotosCount * 4));
  const weighted = (market * settings.marketWeight + commitment * settings.commitmentWeight + fit * settings.fitWeight + readiness * settings.readinessWeight) / 100;
  const total = Math.round(weighted);
  const band = total >= settings.enterpriseThreshold ? "Enterprise" : total < settings.rejectThreshold ? "Reject" : "Growth";
  const scenarios = mcvScenarios(monthlyVolume, minimumVolume, unitRevenue, activeMonths, appliedAnnualTarget);

  return {
    pillars: { market: Math.round(market), commitment: Math.round(commitment), fit: Math.round(fit), readiness: Math.round(readiness) },
    total,
    band,
    reasoning: buildReasoning(data, { monthlyVolume, appliedAnnualTarget, capability, scenarios, readiness }),
    scenarios,
    recommendation: recommendedAction(band, capability),
    internalAssumptions: { capability, monthlyVolume, minimumVolume, unitRevenue, activeMonths, appliedAnnualTarget },
  };
}

export function missingTasks(data: EnquiryInput) {
  const tasks: string[] = [];
  if (!data.hasPrimaryPackaging) tasks.push("Provide primary packaging details");
  if (!data.hasSecondaryPackaging) tasks.push("Provide secondary packaging details");
  if (!data.hasProductSpecs) tasks.push("Provide product specification");
  if (!data.hasAllergens) tasks.push("Provide allergen and compliance information");
  if (!data.hasSpecSheet && !data.specDocumentsCount) tasks.push("Upload spec sheet if available");
  if (!data.runVolume) tasks.push("Confirm expected units per run");
  if (data.frequency === "unknown") tasks.push("Confirm whether this is one-off or repeat work");
  if (!data.productDetails) tasks.push("Describe the product and preparation requirements");
  if (!data.packageFormat) tasks.push("Describe the package format");
  if (!data.freeIssuedItems && !data.pakcoSourcedItems) tasks.push("Confirm free-issued and Pakco-sourced materials");
  if (!data.extractionConfirmed && (data.specDocumentsCount || data.productPhotosCount)) tasks.push("Confirm assisted extraction fields");
  return tasks;
}

export function roleTasks(score: Score) {
  const tasks = [{ role: "Commercial", task: "Approve lead band and customer response", status: "Open" }];
  if (score.band !== "Reject") tasks.push({ role: "Production", task: "Confirm production fit and capacity assumptions", status: "Open" });
  if (score.internalAssumptions.capability === "machinery") {
    tasks.push({ role: "Engineering", task: `Assess sourced machinery and ${settings.machineryLeadTime} commissioning path`, status: "Open" });
    tasks.push({ role: "Finance", task: "Validate machinery amortisation coverage", status: "Open" });
  } else if (score.band === "Enterprise") {
    tasks.push({ role: "Finance", task: "Validate MCV revenue assumptions", status: "Open" });
  }
  return tasks;
}

export const productLabels: Record<ProductType, string> = {
  hotfill: "Hot-fill / jarring",
  ambientLiquid: "Ambient liquid filling",
  viscous: "Sauce, syrup, paste, or viscous filling",
  dryFill: "Dry powder, granule, or dry goods filling",
  pouch: "Pouch, sachet, or stick-pack filling",
  bottle: "Bottle, tub, cup, or container filling",
  carton: "Cartoning, sleeving, or case packing",
  label: "Labelling, lidding, coding, or sleeving",
  bundle: "Multipack, kitting, bundling, or gift packs",
  display: "Retail display, shipper, or promotional builds",
  rework: "Rework, inspection, relabelling, or repacking",
  sample: "Samples, trial packs, or short-run launch packs",
  cold: "Cold-fill, chilled, frozen, or temperature-sensitive packing",
  customLine: "Custom line build or machinery-sourced project",
  other: "Other co-packaging requirement",
};

export function triageCustomerFlow(data: EnquiryInput, score = scoreEnquiry(data)): CustomerFlow {
  const internalReasons: string[] = [];
  const requiredFields: CustomerFlow["requiredFields"] = [];
  const stages: CustomerFlow["stages"] = ["contact", "product"];
  const isEnterprise = score.band === "Enterprise" || score.internalAssumptions.monthlyVolume >= settings.monthlyVolumeThreshold;
  const isMachinery = score.internalAssumptions.capability === "machinery";
  const lacksSpecs = !data.hasProductSpecs || !data.hasSpecSheet || !data.productDetails || !data.packageFormat;

  let path: CustomerFlow["path"] = "standard";
  let customerMessage = "Thanks. We can continue with a standard quote review.";

  if (isMachinery) {
    path = "machinery";
    customerMessage = "This looks like a custom line or machinery-supported opportunity. We need preparation, sourcing, and process details before review.";
    internalReasons.push("Capability triage routed this to machinery/custom-line review.");
  } else if (isEnterprise) {
    path = "enterprise";
    customerMessage = "This looks like an enterprise opportunity. Please add product specs, packaging details, sourcing split, and NDA preference.";
    internalReasons.push("Volume or weighted score meets enterprise triage thresholds.");
  } else if (lacksSpecs) {
    path = "missingSpecs";
    customerMessage = "We need a little more product and packaging detail before Pakco can review this confidently.";
    internalReasons.push("Specs, packaging, or detailed product information is incomplete.");
  }

  if (path === "enterprise" || path === "machinery" || path === "missingSpecs") {
    stages.push("documents", "extraction", "details");
    requiredFields.push("productDetails", "packageFormat", "onsitePreparation", "freeIssuedItems", "pakcoSourcedItems", "extractionConfirmed");
  }
  if (path === "enterprise" || path === "machinery" || data.ndaOption !== "none") {
    stages.push("nda");
    requiredFields.push("ndaOption");
  }
  stages.push("review");

  if (isMachinery) requiredFields.push("qaConsiderations");
  if (lacksSpecs) internalReasons.push("Customer flow should request upload or manual structured details.");

  return {
    path,
    stages: Array.from(new Set(stages)),
    requiredFields: Array.from(new Set(requiredFields)),
    customerMessage,
    internalReasons,
  };
}

export function normalizeInput(input: Partial<EnquiryInput>): EnquiryInput {
  return {
    company: input.company?.trim() || "Unnamed company",
    email: input.email?.trim().toLowerCase() || "",
    contactName: input.contactName?.trim() || "",
    productType: input.productType || "other",
    runVolume: number(input.runVolume),
    frequency: input.frequency || "unknown",
    productStage: input.productStage || "unknown",
    urgency: input.urgency || "flexible",
    notes: input.notes?.trim() || "",
    hasPrimaryPackaging: Boolean(input.hasPrimaryPackaging),
    hasSecondaryPackaging: Boolean(input.hasSecondaryPackaging),
    hasProductSpecs: Boolean(input.hasProductSpecs),
    hasAllergens: Boolean(input.hasAllergens),
    hasSpecSheet: Boolean(input.hasSpecSheet),
    specDocumentsCount: number(input.specDocumentsCount),
    productPhotosCount: number(input.productPhotosCount),
    ndaOption: input.ndaOption || "none",
    ndaDocumentsCount: number(input.ndaDocumentsCount),
    productDetails: input.productDetails?.trim() || "",
    packageFormat: input.packageFormat?.trim() || "",
    packagingDesign: input.packagingDesign?.trim() || "",
    onsitePreparation: input.onsitePreparation?.trim() || "",
    qaConsiderations: input.qaConsiderations?.trim() || "",
    freeIssuedItems: input.freeIssuedItems?.trim() || "",
    pakcoSourcedItems: input.pakcoSourcedItems?.trim() || "",
    extractionConfirmed: Boolean(input.extractionConfirmed),
  };
}

function mcvScenarios(monthlyVolume: number, minimumVolume: number, unitRevenue: number, activeMonths: number, appliedAnnualTarget: number) {
  const baseVolume = monthlyVolume || minimumVolume || 0;
  return {
    conservative: Math.round(baseVolume * 0.75 * unitRevenue * activeMonths),
    base: Math.round(baseVolume * unitRevenue * activeMonths),
    upside: Math.round(baseVolume * 1.25 * unitRevenue * activeMonths),
    target: Math.round(appliedAnnualTarget),
    gap: Math.round(appliedAnnualTarget - baseVolume * unitRevenue * activeMonths),
    takeOrPayCovered: Math.round(minimumVolume * unitRevenue * activeMonths),
  };
}

function buildReasoning(data: EnquiryInput, score: { monthlyVolume: number; appliedAnnualTarget: number; capability: string; scenarios: Score["scenarios"]; readiness: number }) {
  const reasons: string[] = [];
  if (isBusinessEmail(data.email)) reasons.push("Business email and company details provide a stronger commercial signal.");
  if (score.monthlyVolume >= settings.monthlyVolumeThreshold) reasons.push("Estimated recurring volume meets the configured enterprise threshold.");
  if (data.productStage === "concept") reasons.push("Concept-stage product needs clearer specs before a firm quote path.");
  if (data.specDocumentsCount || data.productPhotosCount) reasons.push("Uploaded documents or product photos improve quote readiness.");
  if (score.capability === "machinery") reasons.push(`Route to engineering and finance review with ${settings.machineryLeadTime} as a lead-time assumption.`);
  if (score.readiness < 50) reasons.push("Readiness is limited because specs, packaging, allergen, or compliance details are incomplete.");
  if (score.scenarios.base >= score.appliedAnnualTarget) reasons.push("Base MCV scenario supports the configured enterprise target.");
  if (score.scenarios.base < score.appliedAnnualTarget) reasons.push(`Finance should review the revenue gap against the ${currency(score.appliedAnnualTarget)} annual target.`);
  return [...reasons, "Lead band is internal only; staff approval is required before customer action."];
}

function recommendedAction(band: Score["band"], capability: Score["internalAssumptions"]["capability"]) {
  if (band === "Enterprise") return capability === "machinery" ? "Escalate to CEO, CFO, engineering, and commercial for machinery review." : "Escalate to CEO engagement and senior commercial review.";
  if (band === "Growth") return "Send missing-information request and continue commercial nurture.";
  return "Prepare a polite decline or redirect for staff approval.";
}

function getNdaState(data: EnquiryInput) {
  if (data.ndaOption === "customer" || data.ndaDocumentsCount > 0) return "Customer NDA uploaded";
  if (data.ndaOption === "pakco") return "Pakco NDA requested";
  return "Not requested";
}

function inferCapability(data: EnquiryInput): Score["internalAssumptions"]["capability"] {
  const notes = data.notes.toLowerCase();
  if (["hotfill", "ambientLiquid", "viscous", "bottle", "label", "carton", "bundle", "display", "rework", "sample"].includes(data.productType)) return "current";
  if (["dryFill", "pouch", "cold", "customLine"].includes(data.productType)) return "machinery";
  if (notes.includes("machine") || notes.includes("equipment") || notes.includes("new line")) return "machinery";
  return "adjacent";
}

function estimateMonthlyVolume(data: EnquiryInput) {
  return Math.round(number(data.runVolume) * valueMap(data.frequency, { unknown: 0, once: 1 / 12, quarterly: 1 / 3, monthly: 1, fortnightly: 2, weekly: 4 }));
}

function scoreThreshold(value: number, threshold: number, points: number) {
  return threshold ? Math.min(points, (number(value) / threshold) * points) : 0;
}

function isBusinessEmail(email = "") {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return Boolean(domain && !["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com"].includes(domain));
}

function valueMap<T extends string>(value: T, map: Record<T, number>) {
  return map[value] ?? 0;
}

function number(value: unknown) {
  return Number.parseFloat(String(value)) || 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function currency(value: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
