import { readFile } from "node:fs/promises";

// Preview one simulated website export without committing cases.
const csv = await readFile("data/exports/website.csv", "utf8");
const response = await fetch("http://localhost:3000/api/imports/preview", {
  method: "POST",
  headers: {
    "content-type": "text/csv",
    "x-source-platform": "website",
    "x-source-name": "website.csv",
    "x-actor-id": "demo-reviewer",
  },
  body: csv,
});
const result = await response.json();
console.log(JSON.stringify(result.counts, null, 2));
console.log(`review batch: ${result.batchId ?? result.repeatedBatchId}`);
