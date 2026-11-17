import { collectNationalMeetings } from "./collect-national-meetings.mjs";
import { collectCustomAA } from "./collect-custom-aa.mjs";
import { collectOnlineAA } from "./collect-online-aa.mjs";
import { collectNationalNA } from "./collect-national-na.mjs";
const root = process.cwd();
console.log(await collectNationalMeetings(root));
console.log(await collectCustomAA(root));
console.log(await collectOnlineAA(root));
console.log(await collectNationalNA(root));
console.log(
  "Captures saved in ignored .local storage. Validate and stage with install-national-meetings.mts before publication.",
);
