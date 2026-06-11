export type ProductType =
  | "hotfill"
  | "ambientLiquid"
  | "viscous"
  | "dryFill"
  | "pouch"
  | "bottle"
  | "carton"
  | "label"
  | "bundle"
  | "display"
  | "rework"
  | "sample"
  | "cold"
  | "customLine"
  | "other";

export type Frequency = "unknown" | "once" | "quarterly" | "monthly" | "fortnightly" | "weekly";
export type ProductStage = "unknown" | "concept" | "pilot" | "ready" | "repeat";
export type Urgency = "flexible" | "standard" | "urgent";
export type EnquiryState = "draft" | "submitted";
export type IntakeStage =
  | "contact"
  | "product"
  | "documents"
  | "extraction"
  | "details"
  | "nda"
  | "review";

export type EnquiryInput = {
  company: string;
  email: string;
  contactName: string;
  productType: ProductType;
  runVolume: number;
  frequency: Frequency;
  productStage: ProductStage;
  urgency: Urgency;
  notes: string;
  hasPrimaryPackaging: boolean;
  hasSecondaryPackaging: boolean;
  hasProductSpecs: boolean;
  hasAllergens: boolean;
  hasSpecSheet: boolean;
  specDocumentsCount: number;
  productPhotosCount: number;
  ndaOption: "none" | "pakco" | "customer";
  ndaDocumentsCount: number;
  productDetails: string;
  packageFormat: string;
  packagingDesign: string;
  onsitePreparation: string;
  qaConsiderations: string;
  freeIssuedItems: string;
  pakcoSourcedItems: string;
  extractionConfirmed: boolean;
};

export type Score = {
  pillars: {
    market: number;
    commitment: number;
    fit: number;
    readiness: number;
  };
  total: number;
  band: "Enterprise" | "Growth" | "Reject";
  reasoning: string[];
  scenarios: {
    conservative: number;
    base: number;
    upside: number;
    target: number;
    gap: number;
    takeOrPayCovered: number;
  };
  recommendation: string;
  internalAssumptions: {
    capability: "current" | "adjacent" | "machinery" | "poor";
    monthlyVolume: number;
    minimumVolume: number;
    unitRevenue: number;
    activeMonths: number;
    appliedAnnualTarget: number;
  };
};

export type CustomerFlow = {
  path: "enterprise" | "machinery" | "missingSpecs" | "standard";
  stages: IntakeStage[];
  requiredFields: (keyof EnquiryInput)[];
  customerMessage: string;
  internalReasons: string[];
};

export type UploadedFile = {
  id: string;
  enquiryId: string;
  originalName: string;
  storedPath: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type ExtractedField = {
  id: string;
  enquiryId: string;
  fieldKey: keyof EnquiryInput;
  value: string;
  confidence: "draft" | "low" | "manual";
  sourceFileId?: string;
  confirmed: boolean;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  enquiryId: string;
  message: string;
  createdAt: string;
};

export type Enquiry = {
  id: string;
  reference: string;
  state: EnquiryState;
  currentStage: IntakeStage;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  revision: number;
  data: EnquiryInput;
  customerFlow: CustomerFlow;
  score: Score;
  ndaState: string;
  missingTasks: string[];
  roleTasks: { role: string; task: string; status: string }[];
  decisions: string[];
  audit: string[];
  uploadedFiles: UploadedFile[];
  extractedFields: ExtractedField[];
};
