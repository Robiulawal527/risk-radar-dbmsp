import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "../data/crime-statistics-bangladesh-2020-25.csv");

const UNIT_COORDS = {
  DMP: { name: "Dhaka Metropolitan", area: "Dhaka", lat: 23.8103, lng: 90.4125 },
  CMP: { name: "Chattogram Metropolitan", area: "Chattogram", lat: 22.3569, lng: 91.7832 },
  KMP: { name: "Khulna Metropolitan", area: "Khulna", lat: 22.8456, lng: 89.5403 },
  RMP: { name: "Rajshahi Metropolitan", area: "Rajshahi", lat: 24.3745, lng: 88.6042 },
  BMP: { name: "Barishal Metropolitan", area: "Barishal", lat: 22.701, lng: 90.3535 },
  SMP: { name: "Sylhet Metropolitan", area: "Sylhet", lat: 24.8949, lng: 91.8687 },
  RPMP: { name: "Rangpur Metropolitan", area: "Rangpur", lat: 25.7439, lng: 89.2752 },
  GMP: { name: "Gazipur Metropolitan", area: "Gazipur", lat: 24.0023, lng: 90.4264 },
  Dhaka: { name: "Dhaka Range", area: "Dhaka Range", lat: 23.9999, lng: 90.4203 },
  Mymensingh: { name: "Mymensingh Range", area: "Mymensingh", lat: 24.7471, lng: 90.4203 },
  Chittagong: { name: "Chattogram Range", area: "Chattogram Range", lat: 22.515, lng: 91.7539 },
  Sylhet: { name: "Sylhet Range", area: "Sylhet Range", lat: 24.9045, lng: 91.8611 },
  Rajshahi: { name: "Rajshahi Range", area: "Rajshahi Range", lat: 24.3636, lng: 88.6241 },
  Rangpur: { name: "Rangpur Range", area: "Rangpur Range", lat: 25.8483, lng: 88.9414 },
  Khulna: { name: "Khulna Range", area: "Khulna Range", lat: 22.817, lng: 89.5503 },
  Barishal: { name: "Barishal Range", area: "Barishal Range", lat: 22.701, lng: 90.3535 },
  Railway: { name: "Railway Police", area: "Railway", lat: 23.685, lng: 90.3563 }
};

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

const CATEGORIES = [
  "Dacoity", "Robbery", "Murder", "Speedy Trial", "Riot", "Woman & Child Repression",
  "Kidnapping", "Police Assault", "Burglary", "Theft", "Other Cases", "Arms Act",
  "Explosive", "Narcotics", "Smuggling"
];

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else current += char;
  }
  values.push(current.trim());
  return values;
}

function readDataset() {
  const raw = fs.readFileSync(DATA_PATH, "utf8").replace(/^\uFEFF/, "").trim();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
    const unit = row["Unit Name"];
    const coords = UNIT_COORDS[unit] || { name: unit, area: unit, lat: 23.685, lng: 90.3563 };
    const year = Number(row.Year);
    const monthName = row.Month;
    const month = MONTHS[String(monthName).toLowerCase()] || 1;
    const totalCases = Number(row["Total Cases"] || 0);
    const categoryCounts = Object.fromEntries(CATEGORIES.map((cat) => [cat, Number(row[cat] || 0)]));
    const maxCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      id: index + 1,
      year,
      month,
      monthName,
      unit,
      unitName: coords.name,
      area: coords.area,
      lat: coords.lat,
      lng: coords.lng,
      totalCases,
      categoryCounts,
      topCrimeType: maxCategory?.[0] || "Other Cases",
      topCrimeCount: maxCategory?.[1] || 0
    };
  });
}

const rows = readDataset();
const maxTotal = Math.max(...rows.map((r) => r.totalCases));
const avgTotal = rows.reduce((sum, r) => sum + r.totalCases, 0) / rows.length;

function riskScore(totalCases) {
  const normalized = Math.round((totalCases / maxTotal) * 100);
  return Math.max(1, Math.min(100, normalized));
}

function severity(score) {
  if (score >= 70) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

function filterRows(req) {
  const { year, unit, type, from, to } = req.query;
  return rows.filter((row) => {
    if (year && row.year !== Number(year)) return false;
    if (unit && row.unit.toLowerCase() !== String(unit).toLowerCase()) return false;
    if (type && !(row.categoryCounts[type] > 0)) return false;
    const date = `${row.year}-${String(row.month).padStart(2, "0")}-01`;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_, res) => res.json({ ok: true, records: rows.length }));

app.get("/api/crimes", (req, res) => {
  const data = filterRows(req).map((row) => {
    const score = riskScore(row.totalCases);
    return {
      ...row,
      riskScore: score,
      severity: severity(score),
      description: `${row.unitName} reported ${row.totalCases.toLocaleString()} total cases in ${row.monthName} ${row.year}. Highest category: ${row.topCrimeType} (${row.topCrimeCount}).`,
      date: `${row.year}-${String(row.month).padStart(2, "0")}-01`
    };
  });
  res.json(data);
});

app.get("/api/heatmap", (req, res) => {
  const data = filterRows(req);
  const byUnit = new Map();
  for (const row of data) {
    const current = byUnit.get(row.unit) || { ...row, totalCases: 0 };
    current.totalCases += row.totalCases;
    byUnit.set(row.unit, current);
  }
  const max = Math.max(...[...byUnit.values()].map((r) => r.totalCases), 1);
  res.json([...byUnit.values()].map((row) => ({
    unit: row.unit,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
    intensity: Number((row.totalCases / max).toFixed(3)),
    totalCases: row.totalCases,
    riskScore: Math.round((row.totalCases / max) * 100)
  })));
});

app.get("/api/dashboard", (_, res) => {
  const totalCases = rows.reduce((sum, row) => sum + row.totalCases, 0);
  const highRiskAreas = new Set(rows.filter((row) => riskScore(row.totalCases) >= 70).map((row) => row.unit)).size;
  const latestYear = Math.max(...rows.map((r) => r.year));
  const previousYear = latestYear - 1;

  const byUnit = new Map();
  const byCategory = Object.fromEntries(CATEGORIES.map((cat) => [cat, 0]));
  const byMonth = new Map();

  for (const row of rows) {
    byUnit.set(row.unit, (byUnit.get(row.unit) || 0) + row.totalCases);
    for (const cat of CATEGORIES) byCategory[cat] += row.categoryCounts[cat];
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) || 0) + row.totalCases);
  }

  const rankings = [...byUnit.entries()]
    .map(([unit, total]) => ({
      unit,
      area: UNIT_COORDS[unit]?.area || unit,
      score: Math.round((total / Math.max(...byUnit.values())) * 100),
      totalCases: total
    }))
    .sort((a, b) => b.score - a.score);

  const categoryChart = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const trend = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, crimes]) => ({ month, crimes }));

  res.json({
    stats: {
      totalCases,
      totalRecords: rows.length,
      highRiskAreas,
      averageMonthlyCases: Math.round(avgTotal),
      latestYear,
      previousYear
    },
    rankings,
    categoryChart,
    trend,
    categories: CATEGORIES,
    units: Object.keys(UNIT_COORDS)
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Risk Radar API running on http://localhost:${PORT}`));
