import type { Resource } from "./types";
export function resourceActions(r: Resource) {
  const actions: { label: string; href: string; external?: boolean }[] = [];
  if (r.meeting && r.formats.some((f) => f === "online" || f === "hybrid")) {
    actions.push({
      label: r.meeting.joinUrl ? "Join online" : "Joining details",
      href: r.meeting.joinUrl || r.website,
      external: true,
    });
  }
  const phone = r.phone.replace(/[^+\d]/g, "");
  if (/\d{3}/.test(phone))
    actions.push({ label: "Call", href: "tel:" + phone });
  if (
    r.address &&
    !(
      r.kind === "meeting" &&
      r.formats.includes("online") &&
      !r.formats.includes("hybrid")
    )
  ) {
    actions.push({
      label: "Directions",
      href:
        "https://www.google.com/maps/dir/?api=1&destination=" +
        encodeURIComponent(
          [r.address, r.city, r.state, r.zip].filter(Boolean).join(", "),
        ),
      external: true,
    });
  }
  return actions;
}
