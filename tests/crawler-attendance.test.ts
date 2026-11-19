import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCrawlerIndex } from "../src/lib/meeting-index";

const index = `<table><tr><td>Monday</td><td>7:00 am</td>
  <td><a href="https://example.org/meetings/monday/">Monday Group</a></td>
  <td>Club</td><td>10 Main St, Test City, FL 33000, USA</td><td>Test City</td>
  <td></td><td>Online Meeting, Open, Spanish</td><td>25.7</td><td>-80.1</td>
</tr></table>`;

test("publisher weekly view preserves hybrid attendance absent from the crawler index", () => {
  const weekly = `<table><tr><td>Monday7:00 am</td><td></td>
    <td><a href="/meetings/monday?list=weekly">Monday Group</a></td>
    <td>Club <span>In-person and Online</span></td>
  </tr></table>`;
  const [meeting] = parseCrawlerIndex(index, undefined, weekly);
  assert.equal(meeting.attendance_option, "hybrid");
  assert.deepEqual(meeting.types, ["O", "S"]);
  assert.equal(parseCrawlerIndex(index)[0].attendance_option, "online");
  assert.throws(
    () => parseCrawlerIndex(index, undefined, "<table></table>"),
    /no longer matches/,
  );
});
