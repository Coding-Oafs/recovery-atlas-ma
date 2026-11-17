import type { Resource } from "./types";
export function resourceFreshness(r: Resource, now = new Date()) {
  const age = Math.max(
    0,
    Math.floor(
      (now.getTime() - new Date(r.sourceCheckedAt + "T00:00:00Z").getTime()) /
        86400000,
    ),
  );
  return {
    age,
    needsReview: age > (r.meeting ? 30 : 90),
    registry: r.sourceName.startsWith("NPPES"),
    currentEvidence: (r.evidence ?? []).filter(
      (e) =>
        e.checkedAt <= now.toISOString().slice(0, 10) &&
        (!e.expiresAt || e.expiresAt >= now.toISOString().slice(0, 10)),
    ),
  };
}
export const intakeQuestions = [
  "Are you currently offering this service at this location, and are you accepting new people?",
  "What is the earliest appointment or intake? Is a referral required, and can I walk in?",
  "Do you participate in my exact insurance plan and network for this service and location? Who can confirm costs or authorization?",
  "If I do not have coverage, what payment assistance or sliding-scale options are available?",
  "What ages and participant groups does the program serve? Are there eligibility requirements?",
  "What should I bring, where is the entrance, and what accessibility or language support is available?",
  "What transportation, family or follow-up support can you help arrange?",
];
export function resourceQuestions(r: Resource) {
  if (r.meeting) return [
    "Is the meeting still held at this time and location, or online?",
    "Is this meeting open to visitors, and are there participant restrictions?",
    "How do I join, where is the entrance, and can a newcomer listen first?",
    "What accessibility, language, transportation or childcare support is available?",
    "Are there any costs or voluntary contributions?",
  ];
  if (r.kind === "provider") return [
    "Are you accepting new patients, and what is the earliest appointment?",
    "What services, ages and concerns does this practice work with?",
    "Is a referral required, and do you offer telehealth in my state?",
    ...intakeQuestions.slice(2),
  ];
  return intakeQuestions;
}
export function missingPracticalFields(r: Resource) {
  const p = r.practical, missing: string[] = [];
  if (!p?.entrance) missing.push("Entrance");
  if (!p?.transit) missing.push("Transportation");
  if (!p?.childcare || p.childcare === "unknown") missing.push("Childcare");
  if (r.meeting && !p?.newcomers) missing.push("Newcomer guidance");
  if (!r.accessibility.length) missing.push("Accessibility");
  return missing;
}
