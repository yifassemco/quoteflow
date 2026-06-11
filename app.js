const defaultSettings = {
  annualRevenueTarget: 250000,
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
  },
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
  ndaTemplate:
    "Thank you for contacting Pakco. Your NDA request has been received. Our team will send the controlled NDA link to this email address after confirming the enquiry reference.",
};

let settings = mergeSettings(load("pakco-settings", defaultSettings));
let enquiries = load("pakco-enquiries", []).map(normalizeEnquiry);
let selectedId = enquiries[0]?.id || null;

const views = {
  intake: document.querySelector("#intakeView"),
  customer: document.querySelector("#customerView"),
  internal: document.querySelector("#internalView"),
  settings: document.querySelector("#settingsView"),
};

const titles = {
  intake: "New enquiry",
  customer: "Customer return",
  internal: "Internal review",
  settings: "Settings",
};

const form = document.querySelector("#enquiryForm");
const scorePreview = document.querySelector("#scorePreview");
const queueList = document.querySelector("#queueList");
const internalDetail = document.querySelector("#internalDetail");
const settingsForm = document.querySelector("#settingsForm");
const photoPreview = document.querySelector("#photoPreview");
const intakeSteps = [...document.querySelectorAll(".wizard-step")];
const intakeStepDots = [...document.querySelectorAll("[data-step-dot]")];
const intakeStepCount = document.querySelector("#intakeStepCount");
const intakeStepLabel = document.querySelector("#intakeStepLabel");
const intakeProgressText = document.querySelector("#intakeProgressText");
const intakeProgressBar = document.querySelector("#intakeProgressBar");
const intakeBack = document.querySelector("#intakeBack");
const intakeNext = document.querySelector("#intakeNext");
const addDetails = document.querySelector("#addDetails");
const submitTriage = document.querySelector("#submitTriage");
const triageSummary = document.querySelector("#triageSummary");
const intakeStepNames = ["Contact", "Volume", "Brief", "Review", "Details"];
let currentIntakeStep = 0;

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelector("#loadDemo").addEventListener("click", () => fillDemo("enterprise"));
document.querySelector("#loadMachineryDemo").addEventListener("click", () => fillDemo("machinery"));
document.querySelector("#resetForm").addEventListener("click", () => {
  form.reset();
  setIntakeStep(0);
  renderPhotoPreview();
  updatePreview();
});
intakeBack?.addEventListener("click", () => setIntakeStep(currentIntakeStep - 1));
intakeNext?.addEventListener("click", () => {
  if (!validateCurrentStep()) return;
  setIntakeStep(currentIntakeStep + 1);
});
addDetails?.addEventListener("click", () => {
  if (!validateCurrentStep()) return;
  setIntakeStep(4);
});

document.querySelector("#retrieveEnquiry").addEventListener("click", retrieveCustomerCase);
document.querySelector("#requestOtp").addEventListener("click", () => {
  alert("Demo OTP sent. Use 000000 to retrieve the enquiry.");
});

getControl("productPhotos")?.addEventListener("change", renderPhotoPreview);
getControl("ndaDocuments")?.addEventListener("change", () => validateNdaChoice(true));
form.querySelectorAll("input[name='ndaOption']").forEach((radio) => {
  radio.addEventListener("change", () => validateNdaChoice(false));
});
getControl("email")?.addEventListener("input", () => validateNdaChoice(false));

document.querySelector("#resetSettings").addEventListener("click", () => {
  settings = { ...defaultSettings };
  save("pakco-settings", settings);
  hydrateSettings();
  updatePreview();
  renderInternal();
});

form.addEventListener("input", updatePreview);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateNdaChoice(true)) return;
  submitEnquiry();
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = readForm(settingsForm);
  settings = {
    ...settings,
    ...numericSettings(data),
    machineryLeadTime: data.machineryLeadTime || defaultSettings.machineryLeadTime,
    ndaTemplate: data.ndaTemplate || defaultSettings.ndaTemplate,
  };
  save("pakco-settings", settings);
  updatePreview();
  renderInternal();
  alert("Settings saved.");
});

hydrateSettings();
setIntakeStep(0);
updatePreview();
renderInternal();

function switchView(name) {
  Object.entries(views).forEach(([key, section]) => section.classList.toggle("active", key === name));
  document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  document.querySelector("#viewTitle").textContent = titles[name];
  if (name === "internal") renderInternal();
}

function setIntakeStep(step) {
  currentIntakeStep = Math.max(0, Math.min(intakeSteps.length - 1, step));
  intakeSteps.forEach((section, index) => {
    const active = index === currentIntakeStep;
    section.classList.toggle("active", active);
    section.toggleAttribute("hidden", !active);
  });
  intakeStepDots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentIntakeStep);
    dot.classList.toggle("complete", index < currentIntakeStep);
  });
  const progress = Math.round(((currentIntakeStep + 1) / intakeSteps.length) * 100);
  if (intakeStepCount) intakeStepCount.textContent = `Step ${currentIntakeStep + 1} of ${intakeSteps.length}`;
  if (intakeStepLabel) intakeStepLabel.textContent = intakeStepNames[currentIntakeStep];
  if (intakeProgressText) intakeProgressText.textContent = `${progress}% complete`;
  if (intakeProgressBar) intakeProgressBar.style.width = `${progress}%`;
  if (intakeBack) intakeBack.disabled = currentIntakeStep === 0;
  if (intakeNext) intakeNext.hidden = currentIntakeStep >= 3;
  if (addDetails) addDetails.hidden = currentIntakeStep !== 3;
  if (submitTriage) {
    submitTriage.hidden = currentIntakeStep < 3;
    submitTriage.textContent = currentIntakeStep === 4 ? "Submit detailed pack" : "Request quote review";
  }
  updatePreview();
}

function validateCurrentStep() {
  const activeStep = intakeSteps[currentIntakeStep];
  const fields = [...(activeStep?.querySelectorAll("input, select, textarea") || [])];
  return fields.every((field) => field.reportValidity());
}

function submitEnquiry() {
  if (!validateCurrentStep()) return;
  const enquiry = createEnquiry(readForm(form));
  enquiries.unshift(enquiry);
  selectedId = enquiry.id;
  save("pakco-enquiries", enquiries);
  form.reset();
  setIntakeStep(0);
  renderPhotoPreview();
  updatePreview();
  renderInternal();
  switchView("internal");
}

function createEnquiry(data) {
  const now = new Date();
  const score = scoreEnquiry(data);
  const reference = `PKQ-${now.getFullYear()}-${String(enquiries.length + 1).padStart(4, "0")}`;
  const documents = uploadedDocuments(form);
  return {
    id: crypto.randomUUID(),
    reference,
    createdAt: now.toISOString(),
    revision: 1,
    data,
    score,
    ndaState: getNdaState(data, documents),
    documents,
    missingTasks: missingTasks(data),
    roleTasks: roleTasks(score, data),
    decisions: [],
    audit: [`${formatDate(now)} enquiry created`, `${formatDate(now)} ${score.band} recommendation generated`],
  };
}

function normalizeEnquiry(enquiry) {
  if (!enquiry?.data) return enquiry;
  const data = {
    productType: "other",
    frequency: "unknown",
    productStage: "unknown",
    urgency: "flexible",
    ...enquiry.data,
  };
  if (!data.runVolume && data.monthlyVolume) data.runVolume = data.monthlyVolume;
  const score = scoreEnquiry(data);
  return {
    ...enquiry,
    data,
    score,
    missingTasks: missingTasks(data),
    roleTasks: roleTasks(score, data),
    documents: enquiry.documents || [],
  };
}

function scoreEnquiry(data) {
  const monthlyVolume = estimateMonthlyVolume(data);
  const minimumVolume = Math.round(monthlyVolume * valueMap(data.productStage, { unknown: 0, concept: 0.1, pilot: 0.25, ready: 0.55, repeat: 0.75 }));
  const unitRevenue = settings.internalRevenuePerUnit;
  const activeMonths = 12;
  const appliedAnnualTarget = getJobTypeTarget(data.productType);
  const estimatedAnnualValue = monthlyVolume * unitRevenue * activeMonths;
  const attachmentSignal = number(data.specDocumentsCount) * 8 + number(data.productPhotosCount) * 6;
  const companySignal = data.company?.trim() ? 16 : 0;
  const emailSignal = isBusinessEmail(data.email) ? 18 : 4;
  const stageSignal = valueMap(data.productStage, { unknown: 8, concept: 12, pilot: 35, ready: 60, repeat: 78 });
  const market = clamp(companySignal + emailSignal + stageSignal + attachmentSignal);

  const commitment = clamp(
    scoreThreshold(monthlyVolume, settings.monthlyVolumeThreshold, 42) +
      scoreThreshold(minimumVolume, settings.minimumVolumeThreshold, 28) +
      scoreThreshold(estimatedAnnualValue, appliedAnnualTarget, 20) +
      valueMap(data.frequency, { unknown: 0, once: 4, quarterly: 10, monthly: 18, fortnightly: 24, weekly: 28 }),
  );

  const capability = inferCapability(data);
  const capabilityBase = valueMap(capability, { current: 90, adjacent: 76, machinery: 78, poor: 18 });
  const productBoost = valueMap(data.productType, {
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
    jar: 10,
    liquid: 8,
    new: 2,
  });
  const fit = clamp(capabilityBase + productBoost);

  const readinessChecks = [
    data.hasPrimaryPackaging,
    data.hasSecondaryPackaging,
    data.hasProductSpecs,
    data.hasAllergens,
    data.hasSpecSheet || number(data.specDocumentsCount),
  ].filter(Boolean).length;
  const readiness = clamp(
    valueMap(data.productStage, { unknown: 12, concept: 20, pilot: 38, ready: 58, repeat: 68 }) +
      readinessChecks * 7 +
      Math.min(12, number(data.productPhotosCount) * 4),
  );

  const weighted =
    (market * settings.marketWeight +
      commitment * settings.commitmentWeight +
      fit * settings.fitWeight +
      readiness * settings.readinessWeight) /
    (settings.marketWeight + settings.commitmentWeight + settings.fitWeight + settings.readinessWeight);

  const total = Math.round(weighted);
  const band = total >= settings.enterpriseThreshold ? "Enterprise" : total < settings.rejectThreshold ? "Reject" : "Growth";
  const scenarios = mcvScenarios(monthlyVolume, minimumVolume, unitRevenue, activeMonths, appliedAnnualTarget);
  const reasoning = buildReasoning(data, { market, commitment, fit, readiness, total, band, scenarios, capability, monthlyVolume, appliedAnnualTarget });
  return {
    pillars: {
      market: Math.round(market),
      commitment: Math.round(commitment),
      fit: Math.round(fit),
      readiness: Math.round(readiness),
    },
    total,
    band,
    reasoning,
    scenarios,
    recommendation: recommendedAction(band, data),
    internalAssumptions: {
      capability,
      monthlyVolume,
      minimumVolume,
      unitRevenue,
      activeMonths,
      appliedAnnualTarget,
    },
  };
}

function mcvScenarios(monthlyVolume, minimumVolume, unitRevenue, activeMonths, appliedAnnualTarget) {
  const baseVolume = monthlyVolume || minimumVolume || 0;
  const price = unitRevenue || 0;
  return {
    conservative: Math.round(baseVolume * 0.75 * price * activeMonths),
    base: Math.round(baseVolume * price * activeMonths),
    upside: Math.round(baseVolume * 1.25 * price * activeMonths),
    target: Math.round(appliedAnnualTarget),
    gap: Math.round(appliedAnnualTarget - baseVolume * price * activeMonths),
    takeOrPayCovered: Math.round(minimumVolume * price * activeMonths),
  };
}

function buildReasoning(data, score) {
  const reasons = [];
  if (isBusinessEmail(data.email)) reasons.push("Business email and company details provide a stronger commercial signal.");
  if (score.monthlyVolume >= settings.monthlyVolumeThreshold) reasons.push("Estimated recurring volume meets the configured enterprise threshold.");
  if (data.productStage === "concept") reasons.push("Concept-stage product lowers confidence until specs and production requirements are clearer.");
  if (number(data.specDocumentsCount) || number(data.productPhotosCount)) reasons.push("Uploaded documents or product photos improve quote readiness.");
  if (score.capability === "machinery") reasons.push(`Pakco can source and commission new machinery; route for engineering and finance review with ${settings.machineryLeadTime} lead-time assumption.`);
  if (score.capability === "current") reasons.push("Job type appears to fit current Pakco capability.");
  if (score.pillars.readiness < 50) reasons.push("Readiness is limited because specs, packaging, allergen, or compliance details are incomplete.");
  if (score.scenarios.base >= score.appliedAnnualTarget) reasons.push(`Base MCV scenario supports the ${productLabel(data.productType)} enterprise target.`);
  if (score.scenarios.base < score.appliedAnnualTarget) reasons.push(`Enterprise target for this job type is ${currency(score.appliedAnnualTarget)} p.a.; finance should review the gap.`);
  reasons.push("Lead band is inferred internally; the customer is only asked for quote-relevant details.");
  return reasons.length ? reasons : ["Score generated from available intake answers; staff review is required before any action."];
}

function recommendedAction(band, data) {
  const capability = inferCapability(data);
  if (band === "Enterprise") {
    return capability === "machinery"
      ? "Recommend CEO/CFO/engineering roundtable after finance validates amortisation coverage."
      : "Recommend CEO engagement and senior review roundtable.";
  }
  if (band === "Growth") return "Recommend commercial nurture, missing-info request, and staff review.";
  return "Recommend polite decline or redirect, pending staff approval.";
}

function missingTasks(data) {
  const tasks = [];
  if (!data.hasPrimaryPackaging) tasks.push("Provide primary packaging details");
  if (!data.hasSecondaryPackaging) tasks.push("Provide secondary packaging details");
  if (!data.hasProductSpecs) tasks.push("Provide product specification");
  if (!data.hasAllergens) tasks.push("Provide allergen and compliance information");
  if (!data.hasSpecSheet && !data.specDocumentsCount) tasks.push("Upload spec sheet if available");
  if (!number(data.runVolume)) tasks.push("Confirm expected units per run");
  if (data.frequency === "unknown") tasks.push("Confirm whether this is a one-off or repeat program");
  return tasks;
}

function roleTasks(score, data) {
  const tasks = [{ role: "Commercial", task: "Approve lead band and customer response", status: "Open" }];
  if (score.band !== "Reject") tasks.push({ role: "Production", task: "Confirm production fit and capacity assumptions", status: "Open" });
  if (score.internalAssumptions.capability === "machinery") {
    tasks.push({ role: "Engineering", task: `Assess sourced machinery and ${settings.machineryLeadTime} commissioning path`, status: "Open" });
    tasks.push({ role: "Finance", task: "Validate internal machinery amortisation coverage", status: "Open" });
  } else if (score.band === "Enterprise") {
    tasks.push({ role: "Finance", task: "Validate MCV revenue assumptions", status: "Open" });
  }
  return tasks;
}

function getNdaState(data, documents = []) {
  if (data.ndaOption === "customer" || documents.some((document) => document.type === "Customer NDA")) return "Customer NDA Uploaded";
  if (data.ndaOption === "pakco") return "Pakco NDA Sent";
  return "Not Requested";
}

function updatePreview() {
  const data = readForm(form);
  renderTriageSummary(data);
  if (!data.company && !data.email && !number(data.runVolume) && !data.notes) {
    scorePreview.innerHTML = `<div class="empty-state"><h3>Fast quote review</h3><p>Submit the basics now. If Pakco needs more detail, the reference link will bring you back to the exact missing items.</p></div>`;
    return;
  }
  renderCustomerPreview(scorePreview, data);
}

function renderTriageSummary(data) {
  if (!triageSummary) return;
  const missing = missingTasks(data);
  const monthlyVolume = estimateMonthlyVolume(data);
  const readyText = missing.length ? `${missing.length} follow-up item${missing.length === 1 ? "" : "s"} likely` : "No obvious follow-up items";
  triageSummary.innerHTML = `
    <strong>${data.company ? escapeHtml(data.company) : "Quick triage is ready"}</strong>
    <span>${escapeHtml(productLabel(data.productType))} · ${monthlyVolume ? `${monthlyVolume.toLocaleString("en-AU")} estimated units/month` : "volume to confirm"}</span>
    <span>${readyText}. You can submit now and add the detailed pack later.</span>
  `;
}

function renderScore(container, score, data, options = {}) {
  const bandClass = score.band.toLowerCase();
  container.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Lead score</p>
        <h3>${score.total}/100</h3>
      </div>
      <span class="band-pill ${bandClass}">${score.band}</span>
    </div>
    <div class="score-grid">
      ${scoreRow("Market", score.pillars.market)}
      ${scoreRow("Commitment", score.pillars.commitment)}
      ${scoreRow("Pakco fit", score.pillars.fit)}
      ${scoreRow("Readiness", score.pillars.readiness)}
    </div>
    <div class="scenario-grid">
      ${scenario("Target", score.scenarios.target)}
      ${scenario("Conservative", score.scenarios.conservative)}
      ${scenario("Base", score.scenarios.base)}
      ${scenario("Upside", score.scenarios.upside)}
    </div>
    <ul class="reason-list">${score.reasoning.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
    <p class="warning">${escapeHtml(score.recommendation)} Staff approval is required before action.</p>
    ${score.internalAssumptions.capability === "machinery" && options.includePrivate ? `<p class="private">Internal only: validate machinery sourcing, commissioning lead time, amortisation recovery, and minimum contract commitment. Do not expose amortisation logic to customers.</p>` : ""}
  `;
}

function renderCustomerPreview(container, data) {
  const missing = missingTasks(data);
  const monthlyVolume = estimateMonthlyVolume(data);
  const docs = number(data.specDocumentsCount) + number(data.productPhotosCount) + number(data.ndaDocumentsCount);
  container.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Quote readiness</p>
        <h3>${missing.length ? "A few details may be needed" : "Ready for Pakco review"}</h3>
      </div>
      <span class="status-pill">${docs ? `${docs} file${docs === 1 ? "" : "s"}` : "No files yet"}</span>
    </div>
    <div class="customer-summary">
      <div><strong>Product</strong><span>${productLabel(data.productType)}</span></div>
      <div><strong>Estimated monthly volume</strong><span>${monthlyVolume ? monthlyVolume.toLocaleString("en-AU") : "To confirm"}</span></div>
      <div><strong>Timing</strong><span>${urgencyLabel(data.urgency)}</span></div>
      <div><strong>NDA</strong><span>${getNdaState(data)}</span></div>
    </div>
    <p class="customer-note">Pakco will review this request and use your reference number if more information is needed.</p>
    ${missing.length ? `<ul class="reason-list">${missing.slice(0, 4).map((task) => `<li>${escapeHtml(task)}</li>`).join("")}</ul>` : ""}
  `;
}

function renderInternal() {
  queueList.innerHTML = enquiries.length
    ? enquiries.map(queueCard).join("")
    : `<div class="empty-state"><h3>No enquiries yet</h3><p>Create an enquiry to begin internal review.</p></div>`;
  queueList.querySelectorAll(".queue-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedId = card.dataset.id;
      renderInternal();
    });
  });
  const enquiry = enquiries.find((item) => item.id === selectedId);
  if (!enquiry) {
    internalDetail.innerHTML = `<div class="empty-state"><h3>Select an enquiry</h3><p>Review scores, approve actions, override recommendations, and assign finance, production, or engineering tasks.</p></div>`;
    return;
  }
  internalDetail.innerHTML = internalDetailHtml(enquiry);
  renderScore(document.querySelector("#internalScore"), enquiry.score, enquiry.data, { includePrivate: true });
  internalDetail.querySelectorAll("[data-decision]").forEach((button) => {
    button.addEventListener("click", () => recordDecision(enquiry.id, button.dataset.decision));
  });
}

function queueCard(enquiry) {
  return `
    <button class="queue-card ${enquiry.id === selectedId ? "active" : ""}" data-id="${enquiry.id}" type="button">
      <h4>${escapeHtml(enquiry.data.company || "Unnamed company")}</h4>
      <div class="meta-line">${enquiry.reference} · ${enquiry.score.band} · ${enquiry.score.total}/100</div>
      <div class="meta-line">NDA: ${enquiry.ndaState} · Rev ${enquiry.revision}</div>
    </button>
  `;
}

function internalDetailHtml(enquiry) {
  return `
    <div class="panel-header">
      <div>
        <p class="eyebrow">${enquiry.reference}</p>
        <h3>${escapeHtml(enquiry.data.company || "Unnamed company")}</h3>
      </div>
      <span class="band-pill ${enquiry.score.band.toLowerCase()}">${enquiry.score.band}</span>
    </div>
    <div id="internalScore"></div>
    <div class="detail-grid">
      <div class="mini-panel">
        <h4>Missing information</h4>
        <ul class="task-list">${enquiry.missingTasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("") || "<li>No missing tasks.</li>"}</ul>
      </div>
      <div class="mini-panel">
        <h4>Role tasks</h4>
        <ul class="task-list">${enquiry.roleTasks.map((task) => `<li><strong>${task.role}:</strong> ${escapeHtml(task.task)}</li>`).join("")}</ul>
      </div>
      <div class="mini-panel">
        <h4>Capability path</h4>
        <ul class="task-list">
          <li><strong>Job type:</strong> ${escapeHtml(productLabel(enquiry.data.productType))}</li>
          <li><strong>Fit path:</strong> ${escapeHtml(capabilityLabel(enquiry.score.internalAssumptions.capability))}</li>
          <li><strong>Enterprise target:</strong> ${currency(enquiry.score.internalAssumptions.appliedAnnualTarget)} p.a.</li>
          <li><strong>Base gap:</strong> ${currency(Math.max(0, enquiry.score.scenarios.gap))}</li>
        </ul>
      </div>
      <div class="mini-panel">
        <h4>Uploaded documents</h4>
        <ul class="task-list">${enquiry.documents.map((document) => `<li><strong>${escapeHtml(document.type)}:</strong> ${escapeHtml(document.name)}</li>`).join("") || "<li>No files uploaded.</li>"}</ul>
      </div>
      <div class="mini-panel">
        <h4>Human approvals</h4>
        <div class="button-row">
          <button class="primary-button" data-decision="Approved recommendation" type="button">Approve</button>
          <button class="secondary-button" data-decision="Sent to growth nurture" type="button">Growth</button>
          <button class="secondary-button" data-decision="Escalated to CEO roundtable" type="button">Escalate</button>
          <button class="danger-button" data-decision="Decline approved" type="button">Decline</button>
        </div>
      </div>
      <div class="mini-panel">
        <h4>Audit trail</h4>
        <ul class="audit-list">${enquiry.audit.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </div>
  `;
}

function recordDecision(id, decision) {
  enquiries = enquiries.map((enquiry) => {
    if (enquiry.id !== id) return enquiry;
    const entry = `${formatDate(new Date())} human decision: ${decision}`;
    return {
      ...enquiry,
      decisions: [...enquiry.decisions, decision],
      audit: [entry, ...enquiry.audit],
    };
  });
  save("pakco-enquiries", enquiries);
  renderInternal();
}

function retrieveCustomerCase() {
  const ref = document.querySelector("#returnRef").value.trim();
  const email = document.querySelector("#returnEmail").value.trim().toLowerCase();
  const otp = document.querySelector("#otpCode").value.trim();
  const enquiry = enquiries.find((item) => item.reference === ref && item.data.email.toLowerCase() === email);
  const target = document.querySelector("#customerCase");
  if (!enquiry || otp !== "000000") {
    target.innerHTML = `<div class="empty-state"><h3>Unable to retrieve</h3><p>Check the reference number, email, and one-time code.</p></div>`;
    return;
  }
  target.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">${enquiry.reference}</p>
        <h3>${escapeHtml(enquiry.data.company || "Unnamed company")}</h3>
      </div>
      <span class="status-pill">Rev ${enquiry.revision}</span>
    </div>
    <p class="meta-line">NDA status: ${enquiry.ndaState}. NDA remains optional.</p>
    <h4>Requested information</h4>
    <ul class="task-list">${enquiry.missingTasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("") || "<li>No outstanding requests.</li>"}</ul>
    <div class="button-row">
      <button class="primary-button" id="customerUpdate" type="button">Submit update</button>
      <button class="secondary-button" id="customerNdaRequest" type="button">Request Pakco NDA</button>
    </div>
  `;
  document.querySelector("#customerUpdate").addEventListener("click", () => customerRevision(enquiry.id, "Customer submitted updated information"));
  document.querySelector("#customerNdaRequest").addEventListener("click", () => customerRevision(enquiry.id, "Customer requested Pakco NDA"));
}

function customerRevision(id, action) {
  enquiries = enquiries.map((enquiry) => {
    if (enquiry.id !== id) return enquiry;
    const audit = `${formatDate(new Date())} ${action}; internal assumptions require review`;
    return {
      ...enquiry,
      revision: enquiry.revision + 1,
      ndaState: action.includes("NDA") ? "Pakco NDA Sent" : enquiry.ndaState,
      audit: [audit, ...enquiry.audit],
    };
  });
  save("pakco-enquiries", enquiries);
  retrieveCustomerCase();
  renderInternal();
}

function hydrateSettings() {
  Object.entries(settings).forEach(([key, value]) => {
    if (settingsForm.elements[key]) settingsForm.elements[key].value = value;
  });
  Object.entries(settings.jobTypeTargets).forEach(([key, value]) => {
    const field = settingsForm.elements[`target_${key}`];
    if (field) field.value = value;
  });
}

function fillDemo(type) {
  form.reset();
  const demo =
    type === "machinery"
      ? {
          company: "National Frozen Treats",
          email: "innovation@nationalfrozen.example",
          productType: "customLine",
          runVolume: "90000",
          frequency: "monthly",
          productStage: "pilot",
          urgency: "standard",
          notes: "Large icy pole opportunity. Specs are developing and equipment may need sourcing.",
        }
      : {
          company: "Colesworth Pantry Co",
          email: "procurement@pantry.example",
          productType: "hotfill",
          runVolume: "120000",
          frequency: "monthly",
          productStage: "repeat",
          urgency: "urgent",
          notes: "Hot-fill jarring and labelling enquiry with enterprise distribution.",
        };
  Object.entries(demo).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  ["hasPrimaryPackaging", "hasSecondaryPackaging", "hasProductSpecs", "hasAllergens", "hasSpecSheet"].forEach((key) => {
    if (form.elements[key]) form.elements[key].checked = type !== "machinery" || key !== "hasSpecSheet";
  });
  setIntakeStep(3);
  updatePreview();
}

function readForm(target) {
  const data = {};
  [...target.elements].forEach((field) => {
    if (!field.name) return;
    if (field.type === "file") {
      data[`${field.name}Count`] = field.files?.length || 0;
      return;
    }
    if (field.type === "radio") {
      if (field.checked) data[field.name] = field.value;
      return;
    }
    data[field.name] = field.type === "checkbox" ? field.checked : field.value;
  });
  return data;
}

function uploadedDocuments(target) {
  const specDocuments = [...(getControl("specDocuments", target)?.files || [])].map((file) => ({
    type: "Spec document",
    name: file.name,
    size: file.size,
  }));
  const productPhotos = [...(getControl("productPhotos", target)?.files || [])].map((file) => ({
    type: "Product photo",
    name: file.name,
    size: file.size,
  }));
  const ndaDocuments = [...(getControl("ndaDocuments", target)?.files || [])].map((file) => ({
    type: "Customer NDA",
    name: file.name,
    size: file.size,
  }));
  return [...specDocuments, ...productPhotos, ...ndaDocuments];
}

function renderPhotoPreview() {
  if (!photoPreview) return;
  const files = [...(getControl("productPhotos")?.files || [])];
  photoPreview.innerHTML = files.length
    ? files
        .map((file) => {
          const url = URL.createObjectURL(file);
          return `<figure class="photo-preview"><img src="${url}" alt="${escapeHtml(file.name)}" /><figcaption>${escapeHtml(file.name)}</figcaption></figure>`;
        })
        .join("")
    : "";
}

function validateNdaChoice(report = false) {
  const data = readForm(form);
  const ndaUpload = getControl("ndaDocuments");
  const email = getControl("email");
  if (!ndaUpload || !email) return true;
  email.setCustomValidity("");
  ndaUpload.setCustomValidity("");
  if (data.ndaOption === "pakco" && !email.value.trim()) {
    email.setCustomValidity("Enter your contact email so Pakco can send the NDA.");
    if (report) email.reportValidity();
    return false;
  }
  if (data.ndaOption === "customer" && !ndaUpload.files.length) {
    ndaUpload.setCustomValidity("Upload your NDA or choose another NDA option.");
    if (report) ndaUpload.reportValidity();
    return false;
  }
  return true;
}

function getControl(name, target = form) {
  return target?.querySelector(`[name="${name}"]`) || null;
}

function numericSettings(data) {
  return {
    annualRevenueTarget: number(data.annualRevenueTarget),
    jobTypeTargets: jobTypeTargetSettings(data),
    monthlyVolumeThreshold: number(data.monthlyVolumeThreshold),
    minimumVolumeThreshold: number(data.minimumVolumeThreshold),
    internalRevenuePerUnit: number(data.internalRevenuePerUnit),
    rejectThreshold: number(data.rejectThreshold),
    enterpriseThreshold: number(data.enterpriseThreshold),
    marketWeight: number(data.marketWeight),
    commitmentWeight: number(data.commitmentWeight),
    fitWeight: number(data.fitWeight),
    readinessWeight: number(data.readinessWeight),
  };
}

function scoreRow(label, value) {
  return `<div class="score-row"><strong>${label}</strong><div class="meter"><span style="width:${value}%"></span></div><span>${value}</span></div>`;
}

function scenario(label, value) {
  return `<div class="scenario"><strong>${label}</strong><span>${currency(value)}</span></div>`;
}

function valueMap(value, map) {
  return map[value] ?? 0;
}

function getJobTypeTarget(productType) {
  return number(settings.jobTypeTargets?.[productType]) || number(settings.annualRevenueTarget) || defaultSettings.annualRevenueTarget;
}

function jobTypeTargetSettings(data) {
  return Object.fromEntries(
    Object.keys(defaultSettings.jobTypeTargets).map((key) => [
      key,
      number(data[`target_${key}`]) || defaultSettings.jobTypeTargets[key],
    ]),
  );
}

function mergeSettings(saved = {}) {
  return {
    ...defaultSettings,
    ...saved,
    jobTypeTargets: {
      ...defaultSettings.jobTypeTargets,
      ...(saved.jobTypeTargets || {}),
    },
  };
}

function scoreThreshold(value, threshold, points) {
  if (!threshold) return 0;
  return Math.min(points, (number(value) / threshold) * points);
}

function estimateMonthlyVolume(data) {
  const runVolume = number(data.runVolume);
  const multiplier = valueMap(data.frequency, {
    unknown: 0,
    once: 1 / 12,
    quarterly: 1 / 3,
    monthly: 1,
    fortnightly: 2,
    weekly: 4,
  });
  return Math.round(runVolume * multiplier);
}

function inferCapability(data) {
  const notes = `${data.notes || ""}`.toLowerCase();
  const currentTypes = ["hotfill", "ambientLiquid", "viscous", "bottle", "label", "carton", "bundle", "display", "rework", "sample", "jar", "liquid"];
  const strategicTypes = ["dryFill", "pouch", "cold", "customLine", "new"];
  if (currentTypes.includes(data.productType)) return "current";
  if (strategicTypes.includes(data.productType)) return "machinery";
  if (notes.includes("machine") || notes.includes("machinery") || notes.includes("equipment") || notes.includes("new line") || notes.includes("custom line")) return "machinery";
  if (data.productType === "other") return "adjacent";
  return "adjacent";
}

function isBusinessEmail(email = "") {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return Boolean(domain && !["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com"].includes(domain));
}

function productLabel(value) {
  return {
    hotfill: "Hot-fill / jarring",
    ambientLiquid: "Ambient liquid filling",
    viscous: "Sauce, syrup, paste, or viscous filling",
    dryFill: "Dry powder, granule, or dry goods filling",
    pouch: "Pouch, sachet, or stick-pack filling",
    bottle: "Bottle, tub, cup, or container filling",
    carton: "Cartoning, sleeving, or case packing",
    label: "Labelling / lidding / secondary pack",
    bundle: "Multipack, kitting, bundling, or gift packs",
    display: "Retail display, shipper, or promotional builds",
    rework: "Rework, inspection, relabelling, or repacking",
    sample: "Samples, trial packs, or short-run launch packs",
    cold: "Cold-fill, chilled, frozen, or temperature-sensitive packing",
    customLine: "Custom line build or machinery-sourced project",
    other: "Other co-packaging requirement",
    jar: "Hot-fill / jarring",
    liquid: "Liquid filling",
    new: "New or undefined product",
  }[value] || "To confirm";
}

function urgencyLabel(value) {
  return {
    flexible: "Flexible",
    standard: "Next 1-3 months",
    urgent: "As soon as possible",
  }[value] || "To confirm";
}

function capabilityLabel(value) {
  return {
    current: "Current Pakco capability",
    adjacent: "Adjacent co-packaging capability",
    machinery: "Strategic machinery sourcing / custom line build",
    poor: "Low operational fit",
  }[value] || "To confirm";
}

function number(value) {
  return Number.parseFloat(value) || 0;
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function currency(value) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
