/**
 * Condensed from Australian local government / Power Platform use-case patterns.
 * Shapes suggestion chips for the Vibe prompt builder — not exhaustive.
 */
window.VIBE_ROLE_IDEAS = {
  "customer-service": {
    label: "Customer service / contact centre / front desk",
    ideas: [
      "First‑contact resolution app that surfaces approved answers from your intranet/CRM with source links (human reviews outbound mail).",
      "After‑call work helper: turn call notes into a structured CRM case summary and follow‑up task list.",
      "Bin collection / rates status lookup in Power Apps, fed by your APIs or read‑only lists, with Power Automate for escalations.",
    ],
  },
  planning: {
    label: "Planning, development assessment & building",
    ideas: [
      "Pre‑lodgement checklist app against your control library (DCP/LEP references only — planner signs off RFI text).",
      "Submission theme summariser: ingests redacted public submissions, outputs themes for officer review (no auto‑decision).",
      "Condition tracking dashboard for post‑consent compliance with task reminders in Teams.",
  ],
  },
  infrastructure: {
    label: "Infrastructure, assets, engineering & works",
    ideas: [
      "Mobile work‑order capture (photo, GPS) into Dataverse, routing rules in Power Automate, human prioritisation in Power BI.",
      "Inspection findings template: structured defects list from field forms with repeat‑work detection.",
      "Contractor handoff pack: one view of work package, risk notes, and asset IDs — all edits audited.",
  ],
  },
  "waste-environment": {
    label: "Waste, environment, sustainability & parks",
    ideas: [
      "Contamination and education case tracker; trend summaries for community team review before campaigns.",
      "Parks/works request triage: categorise, map, and assign to crews with SLA timers.",
    ],
  },
  community: {
    label: "Community services (libraries, recreation, inclusion)",
    ideas: [
      "Program and grant admin tracker with plain‑language requirement checklists and delegation reminders.",
      "Referral pathfinder: which council/state program applies — recommender only, staff confirms.",
    ],
  },
  finance: {
    label: "Finance, rates, procurement & revenue",
    ideas: [
      "Exception queue for rates/billing: explain variance, required approvals, and audit trail in Dataverse.",
      "Procurement quick‑ref for thresholds and policy clauses — never auto‑approves, links to source policy.",
  ],
  },
  "people-culture": {
    label: "People & culture, WHS, learning & development",
    ideas: [
      "Policy “first draft” Q&A for general staff questions — HR reviews before anything about disputes is relied on.",
      "WHS report triage: mandatory fields, photos, and escalations to WHS officer.",
    ],
  },
  regulatory: {
    label: "Regulatory, compliance, rangers & local law",
    ideas: [
      "Case note assist: time‑stamped, structured field notes; evidence checklist per offence category — no unsent notices.",
      "Patrol / complaint prioritisation with map layers — officer always decides action.",
  ],
  },
  corporate: {
    label: "Corporate, governance, legal, communications",
    ideas: [
      "Committee paper drafting from template + tracked inputs from owners — final text legally reviewed.",
      "FOI search helper over approved indexes (no PII in external models; internal review only).",
  ],
  },
  "it-digital": {
    label: "IT, digital & information management",
    ideas: [
      "Safe experimentation catalogue: which connectors are allowed, data classification, and pilot checklists.",
      "Service desk triage to Knowledge articles with “human verify” step before user‑visible replies.",
  ],
  },
  other: {
    label: "Other / not listed",
    ideas: [
      "Start from your exact pain: describe the manual steps, data sources, and who must approve; ask Vibe for a low‑code prototype scope.",
  ],
  },
};
