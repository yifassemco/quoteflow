# Design System: Pakco QuoteFlow

## 1. Visual Theme & Atmosphere

Pakco QuoteFlow is an enterprise co-packaging workflow, not a marketing site. It should feel like a controlled case file moving through a verified quote process: practical, calm, structured, and certain. The interface should create confidence for enterprise leads by showing what has been saved, what Pakco needs next, and when the enquiry is ready for internal review.

Use a daily-app balanced density: enough information for procurement and internal staff to scan confidently, never so airy that the product feels decorative. Variance is restrained: layouts may be asymmetric when it clarifies priority, but the system should feel ordered and repeatable. Motion is quiet and functional: state changes should confirm progress, not entertain.

Core metaphor: a verified path from enquiry to quote readiness. The customer starts with a simple reference, then moves through staged checkpoints: contact saved, product basics, documents, assisted extraction, detailed requirements, NDA, final review.

## 2. Color Palette & Roles

Use `#1E63B5` as the dominant brand and action color. It represents confidence, enterprise stability, and controlled progress. It should replace the current green, coral, marigold, and decorative pastel system.

- **QuoteFlow Blue** (`#1E63B5`) — Primary brand color. Use for primary buttons, active stages, selected navigation, focus rings, links, reference highlights, and high-confidence progress states.
- **Deep Navy** (`#102A43`) — Primary heading and high-emphasis surface color. Use for app header text, internal review emphasis, and selected queue rows when a dark state is needed.
- **Slate Ink** (`#243447`) — Main body text. Use for labels, values, and dense operational content.
- **Muted Steel** (`#64748B`) — Secondary text, metadata, helper copy, timestamps, and inactive stage descriptions.
- **Canvas Blue Grey** (`#F6F8FB`) — Main application background. Quiet and institutional, with no decorative gradients.
- **Surface White** (`#FFFFFF`) — Forms, review panels, customer return panels, and case surfaces.
- **Blue Wash** (`#EAF2FC`) — Soft selected state, saved-stage receipts, customer reassurance panels, and low-emphasis progress backgrounds.
- **Border Steel** (`#D8E1EC`) — Structural borders, input borders, dividers, table rules, and panel outlines.
- **Success Green** (`#177245`) — Completed and approved states only.
- **Review Amber** (`#B7791F`) — Pending review, needs attention, or finance/engineering review states only.
- **Exception Red** (`#B42318`) — Errors, blocked tasks, declined recommendations, and destructive states only.

Color discipline:

- One brand color: QuoteFlow Blue.
- Green, amber, and red are semantic status colors only.
- Do not use gradients for brand expression.
- Do not use decorative pastel cards.
- Do not use color variety to make the UI feel lively.

## 3. Typography Rules

- **Display and page headings:** Geist, Satoshi, or Aptos. Use weight and spacing for authority, not oversized type. Page titles should generally sit between `1.75rem` and `2.5rem`.
- **Body and UI text:** Same sans-serif family. Use `0.875rem` to `1rem`, with clear line height (`1.45` to `1.6`) for customer-facing explanations.
- **Metadata and reference numbers:** Geist Mono, SF Mono, or a similar monospace. Use for reference numbers, status codes, audit timestamps, score values, stage numbers, and compact operational labels.
- **Numbers:** All scores, volumes, counts, currency, and references must use tabular figures or monospace.
- **Banned:** serif display type, default browser serif stacks, Inter as the default product voice, decorative type pairings, huge hero headlines, and all-caps overuse.

Text should feel like a competent operations team wrote it. Prefer short, concrete labels:

- “Reference created”
- “Product basics saved”
- “Documents needed”
- “Ready for internal review”
- “Missing details”
- “Customer-visible”
- “Internal only”

Avoid vague trust copy:

- “Enterprise-grade confidence”
- “Seamless experience”
- “Unlock your quote journey”
- “Next-generation intake”

## 4. Component Stylings

### Navigation

Use a quiet top navigation. The active tab should use QuoteFlow Blue or Deep Navy with a clear selected state. Navigation should not look like a marketing hero or floating glass card.

### Brand Mark

The `PQ` mark should be flat and controlled. Use QuoteFlow Blue or Deep Navy, not gradients. If a symbol is introduced later, it should combine a path, reference frame, or checkpoint. Avoid food icons, package clipart, sparkles, and mascot logic.

### Buttons

- **Primary:** QuoteFlow Blue fill, white text, medium radius (`0.5rem` to `0.75rem`), no glow. Use for “Save contact and get reference,” “Continue,” and “Submit for internal review.”
- **Secondary:** White or Canvas Blue Grey fill, Border Steel outline, Slate Ink text. Use for Back, Refresh, and secondary navigation actions.
- **Destructive:** Exception Red only for actual decline or destructive states.
- Active feedback may use a subtle `translateY(1px)` or `scale(0.99)`. No bouncing, glow, or playful motion.

### Forms

Forms are the core customer experience. They must feel easy, not small or crowded.

- Label above each input.
- Helper text below only when it reduces uncertainty.
- Required fields should be obvious without shouting.
- Error text appears inline, below the field.
- Focus ring uses QuoteFlow Blue.
- File upload areas should look like document intake, not generic upload widgets.

### Staged Intake

The stepper is a trust mechanism, not decoration.

Each stage must clearly show:

- Current step
- Completed steps
- Next required action
- Saved state
- Reference number once created
- Whether the step is customer-visible or internal-only

The reference number should be treated like a formal receipt. It should be visually prominent after contact details are saved.

### Cards and Panels

Cards should be used for true grouping: enquiry form, reference receipt, document readiness, queue case, internal decision panel. Avoid nested card stacks. Use borders and spacing before shadows. Radius should be consistent and moderate (`0.75rem` to `1rem`), not oversized.

### Internal Review

Internal review should feel like a case-management surface:

- Queue on the left or top with reference, company, state, score, readiness, and updated time.
- Detail panel with score, missing tasks, documents, customer-visible summary, internal-only reasoning, approvals, and audit.
- Decision buttons should be grouped under a clear “Human approval” area.
- Internal-only content must be visibly separated from customer-facing content.

### Status Badges

Badges must be semantic:

- Blue: active or selected
- Green: complete or approved
- Amber: needs review
- Red: blocked, declined, or error
- Grey: draft, inactive, or unknown

Never use badges as decoration.

## 5. Layout Principles

Use grid-first, workflow-first layouts.

- Main max width: `1280px` to `1440px`.
- Intake layout: staged form as the primary surface, with a supporting confidence/reference/readiness panel.
- Internal review layout: queue plus case detail. Avoid dramatic dashboard hero sections.
- Customer return layout: reference lookup plus saved enquiry state.
- Settings/admin surfaces should be denser and calmer than customer intake.

The first screen should immediately answer:

1. What is this product asking me to do?
2. How long will the enquiry take?
3. What has been saved?
4. What happens next?
5. What will Pakco see internally?

Avoid:

- Generic SaaS bento grids
- Three equal metric cards as the main visual idea
- Marketing-style hero composition
- Overly rounded glass panels
- Floating decorative objects
- Background mesh gradients
- Decorative texture that competes with form clarity

## 6. Motion & Interaction

Motion should create certainty.

- Stage transitions: subtle fade or vertical movement under `180ms`.
- Button press: small tactile feedback only.
- Saved state: brief, calm confirmation.
- Loading: skeleton or inline “Saving...” state matching the component shape.
- File upload: show selected, uploaded, and processing states distinctly.

Do not use perpetual decorative loops, cinematic animation, parallax, cursor effects, or scroll choreography. This is an enterprise workflow, not a campaign page.

Animate only `transform` and `opacity`. Never animate layout dimensions unless there is a strong product reason.

## 7. Copy and Content Rules

Write like Pakco is competent, direct, and careful.

Good:

- “Save contact and get reference”
- “Reference created”
- “Pakco may ask for more detail before review”
- “Upload specs, artwork, packaging drawings, or NDA files”
- “Customers do not see internal scoring”
- “Ready for internal review”

Bad:

- “Prototype email send has been recorded”
- “Any file type is accepted for this prototype”
- “Triage changes what comes next”
- “Enterprise opportunity”
- “Dynamic path”
- “Seamless quote journey”

Use real operational terms:

- Spec pack
- Packaging format
- Dieline
- Artwork
- QA considerations
- Allergen information
- Free-issued items
- Pakco-sourced items
- NDA status
- Internal approval
- Audit trail

## 8. Accessibility and Responsive Rules

- Every interactive target must be at least `44px` tall.
- Focus states must be visible and use QuoteFlow Blue.
- Customer progress cannot rely on color alone; include text labels.
- Badges must include readable text, not just color.
- Mobile intake must collapse to a single column with no horizontal scroll.
- Long product labels and job types must wrap cleanly.
- Form copy should remain at least `14px`.
- Internal review tables/lists should stack into readable case cards on mobile.
- Do not hide critical status or reference information on mobile.

Test at:

- `375px` mobile
- `768px` tablet
- `1024px` small laptop
- `1440px` desktop

## 9. Anti-Patterns: Never Do These

- No AI-looking gradients.
- No generic SaaS bento card layouts.
- No vague trust copy.
- No fake metrics.
- No decorative brand clutter.
- No random color variety.
- No purple or neon tech aesthetic.
- No serif display type in the product UI.
- No food clipart, plate icons, jar icons, or mascot marks.
- No huge rounded glassmorphism cards.
- No customer-facing prototype language.
- No internal scoring logic exposed to customers.
- No decorative badges.
- No fake stock people.
- No overconfident automation language.
- No “magic AI extraction” framing. Assisted extraction is a draft that customers confirm.

## 10. Implementation Targets

When applying this system to the current Next.js app:

1. Replace the existing Tailwind color tokens with the QuoteFlow Blue system.
2. Remove the green, coral, marigold, limewash, and skyglass decorative palette.
3. Simplify the body background to Canvas Blue Grey.
4. Make the `PQ` mark flat blue or navy.
5. Rebuild staged intake states around reference number, saved stage, next action, and document readiness.
6. Rewrite prototype/demo wording into production-confidence wording.
7. Make internal review a controlled case file with clear customer-visible and internal-only zones.
8. Keep status colors semantic and sparse.
