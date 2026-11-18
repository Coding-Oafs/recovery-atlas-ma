import { load, type Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import { clock } from "./meeting-index";

const days = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const dayNumber = (text: string) => days.indexOf(text.trim().toLowerCase());
const clean = (text: string) =>
  text
    .replace(/[\u200b\u00a0]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const timePattern =
  /\b(?:1[0-2]|[1-9])(?::[0-5]\d)?\s*[ap]\.?m\.?|\b(?:noon|midnight)\b/i;
const differentProgram =
  /\b(?:al[- ]?anon|alateen|cma|daa|saa|slaa|ca|na|gamblers anonymous|opiates anonymous|debtors anonymous|cocaine anonymous|narcotics anonymous)\b/i;
const specialEvent =
  /\b(?:board meeting|group conscience|anniversary|birthday|monthly|(?:first|second|third|fourth|last|1st|2nd|3rd|4th) (?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/i;
const addresses = {
  mustard: "507 W North Ave, Chicago, IL 60610",
  wicker: "2601 W North Ave, Chicago, IL 60647",
  ross: "4636 Ross Ave, Dallas, TX 75204",
  peak: "1421 N Peak St, Dallas, TX 75204",
  sobe: "1718 Bay Rd, Miami Beach, FL 33139",
  lambda: "28 NE 54th St, Miami, FL 33137",
};

function lines(node: Cheerio<AnyNode>) {
  const copy = node.clone();
  copy.find("br").replaceWith("\n");
  return copy.text().split(/\r?\n/).map(clean).filter(Boolean);
}

export function parseVenueMeetings(html: string, layout: string) {
  const $ = load(html);
  const result: Record<string, unknown>[] = [];
  function meeting(
    address: string,
    day: number,
    rawTime: string,
    label: string,
    open = false,
  ) {
    const time = clock(rawTime);
    const name = clean(
      label.replace(/\s*(?:[–—-]\s*(?:Open|Closed) Meeting|\([OC]\))\s*$/i, ""),
    );
    if (
      day < 0 ||
      !time ||
      !name ||
      differentProgram.test(label) ||
      specialEvent.test(label)
    )
      return;
    const types = [
      ...(/\(C\)|\bclosed meeting\b/i.test(label)
        ? ["C"]
        : open || /\(O\)|\bopen (?:meeting|discussion|topic)\b/i.test(label)
          ? ["O"]
          : []),
      ...(/\bspanish\b/i.test(label) ? ["S"] : []),
      ...(/^(?:men[’']?s)\s+meeting\b/i.test(label) ? ["M"] : []),
      ...(/^(?:women[’']?s)\s+meeting\b/i.test(label) ? ["W"] : []),
    ];
    result.push({
      slug: [address, day, time, name].join("|"),
      name,
      day,
      time,
      formatted_address: address,
      attendance_option: "in_person",
      types,
    });
  }

  if (layout === "mustard-seed") {
    // The first line after the time is the meeting topic. The next names its chairperson.
    $("h2.gutentor-text").each((_, heading) => {
      const day = dayNumber($(heading).text());
      if (day < 0) return;
      const schedule = $(heading)
        .closest(".gutentor-col-wrap")
        .find("p.gutentor-text")
        .first();
      const entries = lines(schedule);
      for (let i = 0; i < entries.length - 1; i++) {
        if (entries[i].match(timePattern)?.[0] === entries[i])
          meeting(addresses.mustard, day, entries[i], entries[i + 1]);
      }
    });
  } else if (layout === "wicker-park") {
    const schedule = $(".paragraph")
      .filter((_, item) => /WPAC MEETING SCHEDULE/i.test($(item).text()))
      .first();
    let day = -1;
    for (const line of lines(schedule)) {
      if (dayNumber(line) >= 0) {
        day = dayNumber(line);
        continue;
      }
      const time = line.match(timePattern);
      if (
        time &&
        time.index !== undefined &&
        time.index + time[0].length === line.length
      )
        meeting(addresses.wicker, day, time[0], line.slice(0, time.index));
    }
  } else if (layout === "dallas-24-hour") {
    let address = "";
    let day = -1;
    $("section .wixui-rich-text").each((_, block) => {
      for (const line of lines($(block))) {
        if (line === "Ross Avenue Group" || line === "Peak Street Group") {
          address =
            line === "Ross Avenue Group" ? addresses.ross : addresses.peak;
          day = -1;
        } else if (dayNumber(line) >= 0) {
          day = dayNumber(line);
        } else {
          const time = line.match(timePattern);
          const label =
            time &&
            time.index === 0 &&
            line.slice(time[0].length).match(/^\s*[-–—]\s*(.+)$/)?.[1];
          if (address && label && time && !label.includes("*"))
            meeting(address, day, time[0], label);
        }
      }
    });
  } else if (layout === "sobe-room") {
    $("table").each((_, table) => {
      const rows = $(table).find("tr").toArray();
      const head = $(rows[0]).children("th").toArray();
      if (
        head.length !== 8 ||
        !head.slice(1).every((cell, i) => dayNumber($(cell).text()) === i)
      )
        return;
      for (const row of rows.slice(1)) {
        const cells = $(row).children("td").toArray();
        if (cells.length !== 8) continue;
        const time = clean($(cells[0]).text());
        cells.slice(1).forEach((cell, day) => {
          const label = clean($(cell).text());
          const style = $(cell).attr("style") || "";
          // The publisher marks online-only slots in yellow and off-site slots with asterisks.
          if (
            !/background|display:\s*none/i.test(style) &&
            !label.includes("*")
          )
            meeting(addresses.sobe, day, time, label, true);
        });
      }
    });
  } else if (layout === "lambda-miami") {
    const imageDays = [
      "Su.png",
      "M.png",
      "T.png",
      "W.png",
      "TH.png",
      "F.png",
      "Sa.png",
    ];
    let day = -1;
    $("main .sqs-block").each((_, block) => {
      const dayImage = $(block)
        .find("img[data-image]")
        .first()
        .attr("data-image")
        ?.split("/")
        .at(-1);
      if (dayImage && imageDays.includes(dayImage))
        day = imageDays.indexOf(dayImage);
      const paragraphs = $(block).find(".sqs-html-content p").toArray();
      const content = clean(
        paragraphs.map((p) => lines($(p)).join(" ")).join(" "),
      );
      // Explicit AA label and room label are required. Neither online metadata nor contact text is retained.
      const inRoom = content.match(
        /^AA\s*[–—-]\s*((?:1[0-2]|[1-9])(?::[0-5]\d)?\s*[ap]m)\s+([^()]+?)\s*\(Room\)/i,
      );
      if (inRoom) meeting(addresses.lambda, day, inRoom[1], inRoom[2]);
    });
  }
  return [...new Map(result.map((row) => [row.slug, row])).values()];
}
