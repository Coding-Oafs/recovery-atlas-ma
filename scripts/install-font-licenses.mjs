import { writeFile } from "node:fs/promises";
for (const family of ["dmsans", "manrope"]) {
  const r = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`,
  );
  if (!r.ok) throw Error("Font license fetch failed");
  await writeFile(`public/fonts/${family}-OFL.txt`, await r.text());
}
console.log("Font licenses included");
