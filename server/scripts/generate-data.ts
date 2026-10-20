import { mkdir, writeFile } from "node:fs/promises";

// Keep the fictional dataset reproducible.
let seed = 20261016;

const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);

const sources = ["whatsapp", "website", "facebook", "spreadsheet"] as const;
const topics = ["Water supply stopped", "Road damage near school", "Clinic queue delay", "Certificate correction"];
const statuses = ["open", "Resolved", "pending?", "in progress", ""];

function dateValue(index: number): string {
  const day = (index % 25) + 1;
  if (index % 11 === 0) return "";
  if (index % 3 === 0) return `${String(day).padStart(2,"0")}/10/2026`;
  if (index % 3 === 1) return `2026-10-${String(day).padStart(2,"0")}`;
  return `${day} Oct 2026`;
}

function sourceRecord(index: number, source: typeof sources[number]) {
  const repeated = index > 0 && index % 37 === 0 ? index - 1 : index;
  const title = index % 29 === 0 ? "Water leaking beside the market" : topics[index % topics.length];
  return { id:`${source.slice(0,2).toUpperCase()}-${1000+repeated}`, title, detail:`Fictional report ${index+1}`, date:dateValue(index), status:statuses[Math.floor(random()*statuses.length)], url:source === "website" || source === "facebook" ? `https://example.invalid/${source}/${1000+repeated}` : "" };
}

function exportShape(source: typeof sources[number], record: ReturnType<typeof sourceRecord>) {
  // Simulate the columns produced by each intake channel.
  if (source === "whatsapp") return { message_id:record.id, message:record.title, notes:record.detail, sent_at:record.date, state:record.status };
  if (source === "website") return { submission_id:record.id, subject:record.title, description:record.detail, received_on:record.date, status:record.status, source_url:record.url };
  if (source === "facebook") return { post_ref:record.id, post_text:record.title, extra:record.detail, created:record.date, moderation_state:record.status, permalink:record.url };
  return { complaint_no:record.id, complaint:record.title, remarks:record.detail, date_received:record.date, case_status:record.status };
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"','""')}"`;
}

function toCsv(rows: Record<string,unknown>[]): string {
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
}

await mkdir("data/exports", { recursive:true });
for (const source of sources) {
  // Write 50 records per source for a 200-case demonstration set.
  const rows = Array.from({ length:50 }, (_, index) => exportShape(source, sourceRecord(index, source)));
  await writeFile(`data/exports/${source}.csv`, toCsv(rows));
  console.log(`${source}: ${rows.length} rows`);
}
console.log("edge cases: mixed dates, missing fields, ambiguous statuses, repeated IDs, similar complaints");