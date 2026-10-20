import { mkdir, writeFile } from "node:fs/promises";

// Keep the fictional dataset reproducible.
let seed = 20261016;

const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);

const sources = ["whatsapp", "website", "facebook", "spreadsheet"] as const;
const statuses = ["open", "Resolved", "pending?", "in progress", ""];

const people = [
  ["Sita Tamang", "9801001001"],
  ["Ram Bahadur Gurung", "9801001002"],
  ["Kamala Magar", "9801001003"],
  ["Bishnu Adhikari", "9801001004"],
  ["Laxmi Chaudhary", "9801001005"],
  ["Prakash Rai", "9801001006"],
  ["Anita Khatri", "9801001007"],
  ["Hari Prasad Poudel", "9801001008"],
];

const places = [
  ["Morang", "Biratnagar Metropolitan City", "8", "Devkota Chowk"],
  ["Dhanusha", "Janakpur Sub-Metropolitan City", "4", "Station Road"],
  ["Kathmandu", "Kirtipur Municipality", "6", "Panga"],
  ["Kaski", "Pokhara Metropolitan City", "12", "Malepatan"],
  ["Rupandehi", "Butwal Sub-Metropolitan City", "9", "Traffic Chowk"],
  ["Surkhet", "Birendranagar Municipality", "7", "Itram"],
  ["Kailali", "Dhangadhi Sub-Metropolitan City", "3", "Campus Road"],
  ["Bhaktapur", "Bhaktapur Municipality", "10", "Suryabinayak"],
];

const complaints = [
  {
    category: "Drinking water",
    title: "No water in the lane for nine days",
    detail:
      "The municipal tap in our lane has been dry since the pipe burst near the chowk. About forty households are buying jars. The ward office said a team would come on Sunday. Nobody came, and the broken section is still open.",
    relief: "Repair the pipe and restore the morning supply. Tell the ward which day the water will return.",
  },
  {
    category: "Road and drainage",
    title: "The school road is broken and floods",
    detail:
      "The blacktop in front of the school has a hole about a meter wide. Children walk around it into the drain when it rains. Two tempos have already scraped the edge. We reported it to the ward last week and were told it is on a list.",
    relief: "Fill the hole before the school week and put a temporary barrier until the patch is finished.",
  },
  {
    category: "Health post",
    title: "The health post queue starts before dawn",
    detail:
      "My child has had fever for four days. We reached the health post at 6 in the morning and the token queue was already past 40. The attendant said the doctor comes only on two days. There is no posted time for those days.",
    relief: "Publish the doctor's days and times at the gate, and keep a separate line for children with fever.",
  },
  {
    category: "Citizenship and certificates",
    title: "Citizenship recommendation has been waiting three weeks",
    detail:
      "I applied at the ward for a recommendation letter for citizenship. The file was accepted and I was given a registration slip. Three weeks later the slip is still in process, and the section officer is not in the office on the days I can travel.",
    relief: "Issue the recommendation, or write which document is still missing.",
  },
  {
    category: "Drinking water",
    title: "Water leaking beside the market",
    detail:
      "A joint on the main line beside the market has been leaking for two weeks. The lane stays wet, and the shops on that side close the shutter early because people cannot walk through. We have photos from the first day.",
    relief: "Close the joint and check the other joints on that line.",
  },
  {
    category: "Road and drainage",
    title: "The tempo stop floods in an hour of rain",
    detail:
      "The stop in front of the campus has no drain. One hour of rain covers the step, and passengers board from the road. Last Tuesday a motorbike slipped there.",
    relief: "Cut a drain from the stop to the roadside ditch and raise the waiting step.",
  },
  {
    category: "Health post",
    title: "The clinic ran out of the child vaccine",
    detail:
      "The immunization day was posted for Wednesday. When we arrived, the staff said the vaccine stock had finished the previous day and the next supply date was not known.",
    relief: "Set the next immunization day in writing and send it to the ward chair so households are not turned away.",
  },
  {
    category: "Citizenship and certificates",
    title: "The vital registration counter closed at noon",
    detail:
      "I came to register a birth. The notice says the counter is open until 3. At noon the shutter was down and no one had written a reason. The hospital slip is only valid for a short period.",
    relief: "Keep the posted hours, or put a note on the door with the next open day.",
  },
  {
    category: "Other",
    title: "Street light out near the chowk",
    detail:
      "The light at the corner has been dark for eleven nights. The lane is used by people walking home from the last tempo. We cannot tell which office owns the pole.",
    relief: "Name the office that maintains the pole and replace the lamp.",
  },
];

function dateValue(index: number): string {
  const day = (index % 25) + 1;
  if (index % 11 === 0) return "";
  if (index % 3 === 0) return `${String(day).padStart(2, "0")}/10/2026`;
  if (index % 3 === 1) return `2026-10-${String(day).padStart(2, "0")}`;
  return `${day} Oct 2026`;
}

function sourceRecord(index: number, source: (typeof sources)[number]) {
  const repeated = index > 0 && index % 37 === 0 ? index - 1 : index;
  const complaint = complaints[index % complaints.length];
  const [name, phone] = people[(index * 3) % people.length];
  const [district, localLevel, ward, place] = places[(index * 5) % places.length];
  return {
    id: `${source.slice(0, 2).toUpperCase()}-${1000 + repeated}`,
    name,
    phone: index % 17 === 0 ? "" : phone,
    district,
    localLevel,
    ward: index % 13 === 0 ? "" : ward,
    place,
    ...complaint,
    date: dateValue(index),
    status: statuses[Math.floor(random() * statuses.length)],
    url:
      source === "website" || source === "facebook"
        ? `https://example.invalid/${source}/${1000 + repeated}`
        : "",
  };
}

function exportShape(source: (typeof sources)[number], record: ReturnType<typeof sourceRecord>) {
  // Each channel keeps its own column names and the same intake.
  if (source === "whatsapp") {
    return {
      message_id: record.id,
      sender_name: record.name,
      sender_phone: record.phone,
      district: record.district,
      municipality: record.localLevel,
      ward: record.ward,
      place: record.place,
      category: record.category,
      message: record.title,
      detail: record.detail,
      requested_action: record.relief,
      sent_at: record.date,
      state: record.status,
    };
  }
  if (source === "website") {
    return {
      submission_id: record.id,
      full_name: record.name,
      mobile: record.phone,
      district: record.district,
      local_level: record.localLevel,
      ward: record.ward,
      place: record.place,
      category: record.category,
      subject: record.title,
      description: record.detail,
      relief_sought: record.relief,
      received_on: record.date,
      status: record.status,
      source_url: record.url,
    };
  }
  if (source === "facebook") {
    return {
      post_ref: record.id,
      author_name: record.name,
      contact: record.phone,
      district: record.district,
      municipality: record.localLevel,
      ward: record.ward,
      place: record.place,
      category: record.category,
      post_text: record.title,
      detail: record.detail,
      ask: record.relief,
      created: record.date,
      moderation_state: record.status,
      permalink: record.url,
    };
  }
  return {
    complaint_no: record.id,
    complainant: record.name,
    phone: record.phone,
    district: record.district,
    local_level: record.localLevel,
    ward: record.ward,
    tole: record.place,
    category: record.category,
    complaint: record.title,
    account: record.detail,
    relief: record.relief,
    date_received: record.date,
    case_status: record.status,
  };
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]): string {
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
}

await mkdir("data/exports", { recursive: true });
for (const source of sources) {
  const rows = Array.from({ length: 50 }, (_, index) => exportShape(source, sourceRecord(index, source)));
  await writeFile(`data/exports/${source}.csv`, toCsv(rows));
  console.log(`${source}: ${rows.length} rows`);
}
console.log("edge cases: mixed dates, missing fields, ambiguous statuses, repeated IDs, similar complaints");
