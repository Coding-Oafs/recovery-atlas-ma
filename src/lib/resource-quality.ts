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
