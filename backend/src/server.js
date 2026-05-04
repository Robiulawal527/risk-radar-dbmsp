import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  initMysqlProfiles,
  isMysqlProfiles,
  mysqlListProfiles,
  mysqlGetByNid,
  mysqlUpsertProfile,
  mysqlUpdatePartial,
  mysqlDeleteProfile,
  mysqlRecordAction
} from "./mysqlProfiles.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/** Always load backend/.env (not cwd), so MySQL works when the server is started from the repo root. */
dotenv.config({ path: path.join(__dirname, "../.env") });
const DATA_PATH = path.join(__dirname, "../data/crime-statistics-bangladesh-2020-25.csv");
const PROFILES_PATH = path.join(__dirname, "../data/profiles.json");

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

function readProfiles() {
  try {
    const data = fs.readFileSync(PROFILES_PATH, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function saveProfiles(profiles) {
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2), "utf8");
}

function normalizeProfile(profile) {
  const intents = Array.isArray(profile.intents)
    ? profile.intents
    : profile.intents
      ? [profile.intents]
      : ["Friendship"];

  const rawId = profile.id;
  const idStr =
    rawId != null && rawId !== ""
      ? String(rawId)
      : Date.now().toString();

  return {
    id: idStr,
    nid: String(profile.nid || ""),
    name: profile.name || "Unknown",
    email: profile.email || "",
    age: profile.age ?? "",
    location: profile.location || "",
    profession: profile.profession || "",
    bio: profile.bio || "",
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    intents,
    crimeScore: Number(profile.crimeScore) || 0,
    philanthropyScore: Number(profile.philanthropyScore) || 0,
    history: Array.isArray(profile.history) ? profile.history : []
  };
}

function trustScore(profile) {
  const c = Number(profile.crimeScore) || 0;
  const p = Number(profile.philanthropyScore) || 0;
  return Math.max(0, 100 - c * 12 + p * 10);
}

function filterProfilesQuery(profiles, req) {
  const { intent, q } = req.query;
  const search = String(q || "").trim().toLowerCase();
  const targetIntent = String(intent || "").trim().toLowerCase();

  return profiles
    .map(normalizeProfile)
    .filter((profile) => {
      if (targetIntent && !profile.intents.some((item) => item.toLowerCase() === targetIntent)) {
        return false;
      }
      if (!search) return true;
      const haystack = [
        profile.name,
        profile.nid,
        profile.profession,
        profile.location,
        profile.bio,
        ...profile.interests
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    })
    .map((profile) => ({
      ...profile,
      trustScore: trustScore(profile)
    }))
    .sort((a, b) => b.trustScore - a.trustScore);
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

app.get("/api/health", (_, res) =>
  res.json({
    ok: true,
    records: rows.length,
    profilesStorage: isMysqlProfiles() ? "mysql" : "json",
    mysqlConfigured: Boolean(process.env.MYSQL_HOST),
    mysqlDatabase: process.env.MYSQL_DATABASE || (isMysqlProfiles() ? "risk_radar" : null)
  })
);

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

app.get("/api/profiles", async (req, res) => {
  try {
    let raw;
    if (isMysqlProfiles()) {
      raw = await mysqlListProfiles();
    } else {
      raw = readProfiles();
    }
    res.json(filterProfilesQuery(raw, req));
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load profiles" });
  }
});

app.get("/api/profiles/:nid", async (req, res) => {
  try {
    let profile;
    if (isMysqlProfiles()) {
      profile = await mysqlGetByNid(req.params.nid);
    } else {
      profile = readProfiles().map(normalizeProfile).find((item) => item.nid === req.params.nid);
    }
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    const normalized = normalizeProfile(profile);
    res.json({
      ...normalized,
      trustScore: trustScore(normalized)
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load profile" });
  }
});

app.post("/api/profiles", async (req, res) => {
  const { nid, name } = req.body;
  if (!nid || !name) return res.status(400).json({ error: "NID and name are required" });

  try {
    if (isMysqlProfiles()) {
      const existed = await mysqlGetByNid(String(nid));
      const saved = await mysqlUpsertProfile({ ...req.body, nid: String(nid), name });
      const normalized = normalizeProfile(saved);
      return res.status(existed ? 200 : 201).json({
        ...normalized,
        trustScore: trustScore(normalized),
        storage: "mysql"
      });
    }

    const profiles = readProfiles().map(normalizeProfile);
    const existingIndex = profiles.findIndex((item) => item.nid === String(nid));
    const payload = normalizeProfile({
      ...req.body,
      nid: String(nid),
      name
    });

    if (existingIndex === -1) profiles.push(payload);
    else profiles[existingIndex] = { ...profiles[existingIndex], ...payload, id: profiles[existingIndex].id };

    saveProfiles(profiles);

    const saved = profiles.find((item) => item.nid === String(nid));
    res.status(existingIndex === -1 ? 201 : 200).json({
      ...saved,
      trustScore: trustScore(saved),
      storage: "json"
    });
  } catch (err) {
    console.error("POST /api/profiles", err);
    res.status(500).json({ error: err.message || "Failed to save profile" });
  }
});

app.post("/api/profiles/action", async (req, res) => {
  const { nid, name, type, details } = req.body;
  if (!nid || !name || !type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    if (isMysqlProfiles()) {
      if (type !== "crime" && type !== "philanthropy") {
        return res.status(400).json({ error: "Invalid type" });
      }
      const profile = await mysqlRecordAction({ nid, name, type, details });
      const normalized = normalizeProfile(profile);
      return res.json({
        ...normalized,
        trustScore: trustScore(normalized)
      });
    }

    const profiles = readProfiles().map(normalizeProfile);
    let profile = profiles.find((p) => p.nid === nid);

    if (!profile) {
      profile = normalizeProfile({ nid, name });
      profiles.push(profile);
    }

    if (type === "crime") {
      profile.crimeScore += 1;
    } else if (type === "philanthropy") {
      profile.philanthropyScore += 1;
    } else {
      return res.status(400).json({ error: "Invalid type" });
    }

    profile.history.push({
      type,
      details: details || "",
      date: new Date().toISOString()
    });

    saveProfiles(profiles);
    res.json({
      ...profile,
      trustScore: trustScore(profile)
    });
  } catch (err) {
    console.error("POST /api/profiles/action", err);
    res.status(500).json({ error: err.message || "Failed to record action" });
  }
});

app.put("/api/profiles/:nid", async (req, res) => {
  const { nid } = req.params;
  const { bio, profession, intents, email, age, location, interests } = req.body;

  try {
    if (isMysqlProfiles()) {
      const updated = await mysqlUpdatePartial(nid, {
        bio,
        profession,
        intents,
        email,
        age,
        location,
        interests
      });
      if (!updated) return res.status(404).json({ error: "Profile not found" });
      const normalized = normalizeProfile(updated);
      return res.json({
        ...normalized,
        trustScore: trustScore(normalized)
      });
    }

    const profiles = readProfiles().map(normalizeProfile);
    const profileIndex = profiles.findIndex((p) => p.nid === nid);

    if (profileIndex === -1) {
      return res.status(404).json({ error: "Profile not found" });
    }

    profiles[profileIndex] = {
      ...profiles[profileIndex],
      bio: bio !== undefined ? bio : profiles[profileIndex].bio,
      profession: profession !== undefined ? profession : profiles[profileIndex].profession,
      intents: intents !== undefined ? (Array.isArray(intents) ? intents : [intents]) : profiles[profileIndex].intents,
      email: email !== undefined ? email : profiles[profileIndex].email,
      age: age !== undefined ? age : profiles[profileIndex].age,
      location: location !== undefined ? location : profiles[profileIndex].location,
      interests: interests !== undefined ? (Array.isArray(interests) ? interests : []) : profiles[profileIndex].interests
    };

    saveProfiles(profiles);
    res.json({
      ...profiles[profileIndex],
      trustScore: trustScore(profiles[profileIndex])
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update profile" });
  }
});

app.delete("/api/profiles/:nid", async (req, res) => {
  const { nid } = req.params;
  try {
    if (isMysqlProfiles()) {
      const ok = await mysqlDeleteProfile(nid);
      if (!ok) return res.status(404).json({ error: "Profile not found" });
      return res.status(204).send();
    }

    const profiles = readProfiles().map(normalizeProfile);
    const next = profiles.filter((p) => p.nid !== nid);
    if (next.length === profiles.length) return res.status(404).json({ error: "Profile not found" });
    saveProfiles(next);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to delete profile" });
  }
});

const PORT = process.env.PORT || 5000;
await initMysqlProfiles();
app.listen(PORT, () => console.log(`Risk Radar API running on http://localhost:${PORT}`));