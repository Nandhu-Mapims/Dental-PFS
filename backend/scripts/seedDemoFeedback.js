/**
 * Adds realistic demo feedback for trying out the dashboards. Existing data is left alone.
 * Every demo row has clientSubmissionId "demo-…", so it can be removed again on its own.
 *
 *   npm run seed-demo                      300 submissions over the last 90 days
 *   npm run seed-demo -- --count 500 --days 120
 *   npm run remove-demo                    deletes only the demo rows
 *
 * Never run this against production data you care about: demo rows look like real feedback
 * on every dashboard until removed.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { HOSPITAL } from "../src/hospital.js";
import { Feedback, mongoose } from "../src/models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/feedbacksystem";
const DEMO_PREFIX = "demo-";

function argNumber(name, fallback) {
  const i = process.argv.indexOf(name);
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

// Seeded random numbers, so the same command gives the same data.
let seed = 20261017;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
function weighted(entries) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = random() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

const DEPARTMENT_WEIGHTS = {
  "Conservative Dentistry & Endodontics": 18,
  "Oral & Maxillofacial Surgery": 16,
  "Orthodontics & Dentofacial Orthopaedics": 14,
  "Prosthodontics and Crown & Bridge": 12,
  "Periodontics & Implantology": 10,
  "Oral Medicine & Radiology": 10,
  "Pedodontics & Preventive Dentistry": 9,
  "Department of Implantology": 5,
  "Public Health Dentistry": 3,
  "Oral & Maxillofacial Pathology": 3,
};
const departments = HOSPITAL.departments.map((d) => [d.name, DEPARTMENT_WEIGHTS[d.name] ?? 4]);

/** What patients say about their treatment, per department. */
const CLINICAL = {
  "Conservative Dentistry & Endodontics": {
    positive: ["Root canal was painless and the doctor explained every step", "Filling was done quickly and matches my tooth"],
    negative: ["Root canal needed three visits and the pain continued", "Temporary filling came off within two days"],
  },
  "Oral & Maxillofacial Surgery": {
    positive: ["Wisdom tooth extraction was smooth and well explained", "Surgeon was calm and the swelling was less than expected"],
    negative: ["Extraction was painful and the anaesthetic wore off early", "Waited four hours for a minor surgery slot"],
  },
  "Orthodontics & Dentofacial Orthopaedics": {
    positive: ["Braces adjustment was gentle and the progress is good", "Doctor showed my teeth movement on the scans"],
    negative: ["Bracket broke and the repair appointment was delayed", "Braces wire was poking my cheek after adjustment"],
  },
  "Prosthodontics and Crown & Bridge": {
    positive: ["New denture fits well and I can eat comfortably", "Crown colour matches my other teeth perfectly"],
    negative: ["Denture is loose and needed three refittings", "Crown was not ready on the promised date"],
  },
  "Periodontics & Implantology": {
    positive: ["Gum treatment reduced the bleeding completely", "Scaling was thorough and the doctor gave good advice"],
    negative: ["Gum surgery follow-up was rescheduled twice", "Scaling was rushed and my gums bled for days"],
  },
  "Oral Medicine & Radiology": {
    positive: ["X-ray was quick and the report was explained clearly", "Diagnosis was accurate and treatment plan was clear"],
    negative: ["X-ray machine was down and I had to come back", "Waited long for the OPG scan report"],
  },
  "Pedodontics & Preventive Dentistry": {
    positive: ["Doctors were very patient with my child", "My son was not scared at all, very friendly staff"],
    negative: ["Child waited too long and got restless", "Fluoride appointment was cancelled without notice"],
  },
  "Department of Implantology": {
    positive: ["Implant procedure was well planned and comfortable"],
    negative: ["Implant cost estimate changed after the surgery"],
  },
  "Public Health Dentistry": {
    positive: ["Dental camp at our village was very useful"],
    negative: ["Camp ran out of tokens before everyone was seen"],
  },
  "Oral & Maxillofacial Pathology": {
    positive: ["Biopsy result was explained kindly and clearly"],
    negative: ["Biopsy report took more than two weeks"],
  },
};

/** What patients say about services, independent of the department they visited. */
const SERVICE_ISSUES = {
  "Front Office": {
    positive: ["Registration at the front office was quick"],
    negative: ["Long queue at registration and token system was confusing", "Appointment was not found at the front desk"],
    topic: "Waiting Time",
  },
  Billing: {
    positive: ["Billing was clear and the staff explained the charges"],
    negative: ["Wrong amount on the bill and it took long to correct", "Billing counter staff were rude"],
    topic: "Billing",
  },
  Pharmacy: {
    positive: ["Medicines were available and given quickly"],
    negative: ["Prescribed medicine was out of stock at the pharmacy"],
    topic: "Medicines",
  },
  "House Keeping": {
    positive: ["Clinic and washrooms were very clean"],
    negative: ["Washroom was dirty and had no water", "Waiting area was not cleaned"],
    topic: "Cleanliness",
  },
  Nursing: {
    positive: ["Dental assistant was caring and helpful"],
    negative: ["Dental assistant was not available after the procedure"],
    topic: "Staff Behaviour",
  },
  Transport: {
    positive: ["College bus to the hospital was on time"],
    negative: ["College bus came very late and was overcrowded", "No bus on Saturday afternoon"],
    topic: "Transport",
  },
  Engineering: {
    positive: ["Air conditioning in the clinic was comfortable"],
    negative: ["Dental chair light was not working", "AC was not working in the waiting hall"],
    topic: "Facilities",
  },
  Security: {
    positive: ["Security staff guided us to the right department"],
    negative: ["Parking was full and security did not help"],
    topic: "Parking",
  },
  Canteen: {
    positive: ["Canteen food was fresh and affordable"],
    negative: ["Canteen was closed and there was no drinking water"],
    topic: "Food & Water",
  },
  "IT Support": {
    positive: ["Report was available online the same day"],
    negative: ["Online report was not visible for days"],
    topic: "Reports",
  },
};
const serviceNames = HOSPITAL.services.map((s) => s.name).filter((n) => SERVICE_ISSUES[n]);

const TAMIL_VOICE = {
  positive: [
    "டாக்டர் நல்லா பார்த்தாங்க, ரொம்ப திருப்தியா இருக்கு",
    "எல்லாரும் அன்பா பேசினாங்க, சுத்தமா இருந்துச்சு",
  ],
  negative: [
    "ரொம்ப நேரம் காத்திருக்க வேண்டியதா இருந்துச்சு",
    "பாத்ரூம் சுத்தமா இல்ல, தண்ணீர் இல்ல",
    "பஸ் லேட்டா வந்துச்சு, ரொம்ப கஷ்டமா இருந்துச்சு",
  ],
};

const FIRST_NAMES = ["Murugan", "Lakshmi", "Senthil", "Kavitha", "Ramesh", "Meena", "Karthik", "Priya", "Arun", "Divya", "Selvi", "Ganesh", "Anitha", "Vijay", "Revathi", "Suresh", "Bhavani", "Prakash", "Nithya", "Manikandan", "Saranya", "Rajesh", "Deepa", "Saravanan", "Malathi"];
const LAST_INITIALS = ["K", "S", "R", "M", "P", "V", "T", "N", "A", "G"];

const BOT_QUESTIONS = [
  "இங்க வர பஸ் வேன் வசதி எப்படி இருந்துச்சு?",
  "இங்க பாத்ரூம் நல்லா சுத்தமா இருந்துச்சா?",
  "டாக்டர் நல்லா பார்த்தாங்களா?",
  "இங்க வேலை பாக்குறவங்க நல்லா பேசினாங்களா?",
  "மொத்தமா இங்க வந்தது எப்படி இருந்துச்சு?",
];

function visitTime(daysBack) {
  for (;;) {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(random() * daysBack));
    // Clinic days and hours: fewer on Saturday, none on Sunday, 9:00–17:00.
    const day = d.getDay();
    if (day === 0 || (day === 6 && random() < 0.5)) continue;
    d.setHours(9 + Math.floor(random() * 8), Math.floor(random() * 60), Math.floor(random() * 60), 0);
    if (d.getTime() > Date.now()) continue;
    return d;
  }
}

function buildSubmission(index, daysBack) {
  const createdAt = visitTime(daysBack);
  // Gentle improvement over the period: more complaints early on than recently.
  const age = (Date.now() - createdAt.getTime()) / (daysBack * 86400000);
  const negativeChance = 0.2 + 0.15 * age;
  const department = weighted(departments);
  const mode = weighted([["standard", 5], ["voice", 2.5], ["bot", 2.5]]);

  const issues = [];
  const clinicalTone = random() < negativeChance ? "negative" : random() < 0.12 ? "neutral" : "positive";
  const clinical = CLINICAL[department];
  if (clinical) {
    const text = clinicalTone === "neutral" ? "Treatment was okay, nothing special" : pick(clinical[clinicalTone]);
    issues.push({ department, recommendedService: "", issueSummary: text, sentiment: clinicalTone });
  }
  const extra = weighted([[0, 4], [1, 4], [2, 2]]);
  const usedServices = new Set();
  for (let i = 0; i < extra; i++) {
    const service = pick(serviceNames);
    if (usedServices.has(service)) continue;
    usedServices.add(service);
    const tone = random() < negativeChance + 0.08 ? "negative" : "positive";
    issues.push({
      department,
      recommendedService: service,
      issueSummary: pick(SERVICE_ISSUES[service][tone]),
      sentiment: tone,
    });
  }

  const negatives = issues.filter((i) => i.sentiment === "negative").length;
  const positives = issues.filter((i) => i.sentiment === "positive").length;
  const overall = negatives > positives ? "negative" : negatives === 0 && positives > 0 ? "positive" : "neutral";
  const rating =
    overall === "positive" ? (random() < 0.6 ? 5 : 4) : overall === "negative" ? (random() < 0.45 ? 1 : 2) : 3;

  const englishText = issues.map((i) => i.issueSummary).join(". ") + ".";
  const comments =
    mode === "voice" && random() < 0.5 ? `${pick(TAMIL_VOICE[overall === "positive" ? "positive" : "negative"])}. ${englishText}` : englishText;

  const topics = [...new Set(issues.filter((i) => i.recommendedService).map((i) => SERVICE_ISSUES[i.recommendedService].topic))];
  if (issues[0]?.recommendedService === "") topics.unshift("Treatment");

  const doc = {
    patientName: `${pick(FIRST_NAMES)} ${pick(LAST_INITIALS)}`,
    department,
    lookupDepartment: "",
    service: issues.find((i) => i.recommendedService)?.recommendedService || "",
    feedbackIssues: issues.map((i) => ({ ...i, suggestedAction: "", ticketId: null })),
    rating,
    comments,
    status: "New",
    source: "patient",
    submissionMode: mode,
    aiSentiment: overall,
    aiUrgency: rating === 1 ? "high" : rating === 2 ? "medium" : "low",
    aiTopics: topics.slice(0, 4),
    aiSummary: englishText,
    aiAnalyzedAt: createdAt,
    clientSubmissionId: `${DEMO_PREFIX}${createdAt.getTime()}-${index}`,
    createdAt,
    updatedAt: createdAt,
  };

  if (mode === "bot") {
    doc.botConversationAnswers = BOT_QUESTIONS.map((questionText, order) => {
      const answerTone = order === 4 ? overall : random() < negativeChance ? "negative" : "positive";
      return {
        questionOrder: order,
        questionText,
        transcript: pick(TAMIL_VOICE[answerTone === "positive" ? "positive" : "negative"]),
        audioRelPath: null,
        answerSentiment: answerTone,
      };
    });
  }
  return doc;
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const dbName = mongoose.connection.db.databaseName;

  if (process.argv.includes("--remove")) {
    const result = await Feedback.deleteMany({ clientSubmissionId: { $regex: `^${DEMO_PREFIX}` } });
    console.log(`[seed-demo] removed ${result.deletedCount} demo feedback from ${dbName}`);
    await mongoose.disconnect();
    return;
  }

  const count = argNumber("--count", 300);
  const days = argNumber("--days", 90);
  const rows = Array.from({ length: count }, (_, i) => buildSubmission(i, days));
  // timestamps: false keeps the backdated createdAt/updatedAt instead of "now".
  await Feedback.insertMany(rows, { timestamps: false });

  const bySentiment = rows.reduce((acc, r) => ({ ...acc, [r.aiSentiment]: (acc[r.aiSentiment] || 0) + 1 }), {});
  console.log(
    `[seed-demo] added ${rows.length} demo feedback over ${days} days to ${dbName}`,
    bySentiment,
    `(total demo rows now ${await Feedback.countDocuments({ clientSubmissionId: { $regex: `^${DEMO_PREFIX}` } })})`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
