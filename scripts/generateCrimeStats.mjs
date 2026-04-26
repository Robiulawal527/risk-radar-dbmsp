import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const csvPath = path.join(root, 'data/crime-statistics-bangladesh-2020-25.csv');

const locations = {
  DMP: {
    name: 'Dhaka Metropolitan',
    nameBn: 'ঢাকা মহানগর',
    unit: 'DMP',
    division: 'Dhaka',
    district: 'Dhaka',
    lat: 23.8103,
    lng: 90.4125,
    aliases: ['Dhaka', 'DMP', 'Dhaka Metro']
  },
  CMP: {
    name: 'Chattogram Metropolitan',
    nameBn: 'চট্টগ্রাম মহানগর',
    unit: 'CMP',
    division: 'Chattogram',
    district: 'Chattogram',
    lat: 22.3569,
    lng: 91.7832,
    aliases: ['Chittagong', 'Chattogram', 'CMP']
  },
  KMP: {
    name: 'Khulna Metropolitan',
    nameBn: 'খুলনা মহানগর',
    unit: 'KMP',
    division: 'Khulna',
    district: 'Khulna',
    lat: 22.8456,
    lng: 89.5403,
    aliases: ['Khulna', 'KMP']
  },
  RMP: {
    name: 'Rajshahi Metropolitan',
    nameBn: 'রাজশাহী মহানগর',
    unit: 'RMP',
    division: 'Rajshahi',
    district: 'Rajshahi',
    lat: 24.3745,
    lng: 88.6042,
    aliases: ['Rajshahi', 'RMP']
  },
  BMP: {
    name: 'Barishal Metropolitan',
    nameBn: 'বরিশাল মহানগর',
    unit: 'BMP',
    division: 'Barishal',
    district: 'Barishal',
    lat: 22.701,
    lng: 90.3535,
    aliases: ['Barisal', 'Barishal', 'BMP']
  },
  SMP: {
    name: 'Sylhet Metropolitan',
    nameBn: 'সিলেট মহানগর',
    unit: 'SMP',
    division: 'Sylhet',
    district: 'Sylhet',
    lat: 24.8949,
    lng: 91.8687,
    aliases: ['Sylhet', 'SMP']
  },
  RPMP: {
    name: 'Rangpur Metropolitan',
    nameBn: 'রংপুর মহানগর',
    unit: 'RPMP',
    division: 'Rangpur',
    district: 'Rangpur',
    lat: 25.7439,
    lng: 89.2752,
    aliases: ['Rangpur', 'RPMP']
  },
  GMP: {
    name: 'Gazipur Metropolitan',
    nameBn: 'গাজীপুর মহানগর',
    unit: 'GMP',
    division: 'Dhaka',
    district: 'Gazipur',
    lat: 23.9999,
    lng: 90.4203,
    aliases: ['Gazipur', 'GMP']
  },
  'Dhaka Range': {
    name: 'Dhaka Range',
    nameBn: 'ঢাকা রেঞ্জ',
    unit: 'Dhaka Range',
    division: 'Dhaka',
    district: 'Dhaka Region',
    lat: 23.685,
    lng: 90.3563,
    aliases: ['Dhaka Range', 'Narayanganj', 'Manikganj', 'Munshiganj']
  },
  'Mymensingh Range': {
    name: 'Mymensingh Range',
    nameBn: 'ময়মনসিংহ রেঞ্জ',
    unit: 'Mymensingh Range',
    division: 'Mymensingh',
    district: 'Mymensingh Region',
    lat: 24.7471,
    lng: 90.4203,
    aliases: ['Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur']
  },
  'Chittagong Range': {
    name: 'Chattogram Range',
    nameBn: 'চট্টগ্রাম রেঞ্জ',
    unit: 'Chittagong Range',
    division: 'Chattogram',
    district: 'Chattogram Region',
    lat: 22.8456,
    lng: 91.0973,
    aliases: ['Chittagong Range', 'Chattogram Range', 'Coxs Bazar', 'Cumilla', 'Noakhali']
  },
  'Sylhet Range': {
    name: 'Sylhet Range',
    nameBn: 'সিলেট রেঞ্জ',
    unit: 'Sylhet Range',
    division: 'Sylhet',
    district: 'Sylhet Region',
    lat: 24.9045,
    lng: 91.8611,
    aliases: ['Sylhet Range', 'Moulvibazar', 'Habiganj', 'Sunamganj']
  },
  'Khulna Range': {
    name: 'Khulna Range',
    nameBn: 'খুলনা রেঞ্জ',
    unit: 'Khulna Range',
    division: 'Khulna',
    district: 'Khulna Region',
    lat: 22.9372,
    lng: 89.2463,
    aliases: ['Khulna Range', 'Jashore', 'Jessore', 'Satkhira', 'Bagerhat']
  },
  'Barishal Range': {
    name: 'Barishal Range',
    nameBn: 'বরিশাল রেঞ্জ',
    unit: 'Barishal Range',
    division: 'Barishal',
    district: 'Barishal Region',
    lat: 22.3811,
    lng: 90.3372,
    aliases: ['Barishal Range', 'Barisal Range', 'Patuakhali', 'Bhola', 'Pirojpur']
  },
  'Rajshahi Range': {
    name: 'Rajshahi Range',
    nameBn: 'রাজশাহী রেঞ্জ',
    unit: 'Rajshahi Range',
    division: 'Rajshahi',
    district: 'Rajshahi Region',
    lat: 24.3636,
    lng: 88.6241,
    aliases: ['Rajshahi Range', 'Bogura', 'Bogra', 'Pabna', 'Natore']
  },
  'Rangpur Range': {
    name: 'Rangpur Range',
    nameBn: 'রংপুর রেঞ্জ',
    unit: 'Rangpur Range',
    division: 'Rangpur',
    district: 'Rangpur Region',
    lat: 25.8483,
    lng: 88.9414,
    aliases: ['Rangpur Range', 'Dinajpur', 'Kurigram', 'Gaibandha', 'Nilphamari']
  },
  'Railway Range': {
    name: 'Railway Range',
    nameBn: 'রেলওয়ে রেঞ্জ',
    unit: 'Railway Range',
    division: 'National',
    district: 'Rail Network',
    lat: 23.7772,
    lng: 90.3994,
    aliases: ['Railway', 'Railway Range', 'Rail Police']
  }
};

const crimeTypes = [
  { csv: 'Dacoity', id: 'dacoity', name: 'Dacoity', nameBn: 'ডাকাতি', color: '#7f1d1d', severity: 5 },
  { csv: 'Robbery', id: 'robbery', name: 'Robbery', nameBn: 'ছিনতাই', color: '#dc2626', severity: 4 },
  { csv: 'Murder', id: 'murder', name: 'Murder', nameBn: 'হত্যা', color: '#991b1b', severity: 5 },
  { csv: 'Speedy Trial', id: 'speedy_trial', name: 'Speedy Trial', nameBn: 'দ্রুত বিচার', color: '#ef4444', severity: 4 },
  { csv: 'Riot', id: 'riot', name: 'Riot', nameBn: 'দাঙ্গা', color: '#f97316', severity: 4 },
  {
    csv: 'Woman & Child Repression',
    id: 'woman_child_repression',
    name: 'Woman & Child Repression',
    nameBn: 'নারী ও শিশু নির্যাতন',
    color: '#be123c',
    severity: 5
  },
  { csv: 'Kidnapping', id: 'kidnapping', name: 'Kidnapping', nameBn: 'অপহরণ', color: '#b91c1c', severity: 5 },
  { csv: 'Police Assault', id: 'police_assault', name: 'Police Assault', nameBn: 'পুলিশের উপর হামলা', color: '#ea580c', severity: 4 },
  { csv: 'Burglary', id: 'burglary', name: 'Burglary', nameBn: 'সিঁধেল চুরি', color: '#f59e0b', severity: 3 },
  { csv: 'Theft', id: 'theft', name: 'Theft', nameBn: 'চুরি', color: '#eab308', severity: 2 },
  { csv: 'Other Cases', id: 'other_cases', name: 'Other Cases', nameBn: 'অন্যান্য মামলা', color: '#64748b', severity: 2 },
  { csv: 'Arms Act', id: 'arms_act', name: 'Arms Act', nameBn: 'অস্ত্র আইন', color: '#6d28d9', severity: 4 },
  { csv: 'Explosive', id: 'explosive', name: 'Explosive', nameBn: 'বিস্ফোরক', color: '#c2410c', severity: 5 },
  { csv: 'Narcotics', id: 'narcotics', name: 'Narcotics', nameBn: 'মাদক', color: '#4f46e5', severity: 3 },
  { csv: 'Smuggling', id: 'smuggling', name: 'Smuggling', nameBn: 'চোরাচালান', color: '#0f766e', severity: 3 }
];

const monthIndex = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11
};

const parseCsv = (text) => {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',');
  return lines
    .map((line) => {
      const values = line.split(',');
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    })
    .filter((row) => row.Year && row.Month && row['Unit Name']);
};

const hash = (value) => {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(31, h) + value.charCodeAt(i);
  return Math.abs(h);
};

const jitter = (key, spread = 0.42) => {
  const a = (hash(`${key}:lat`) % 1000) / 1000 - 0.5;
  const b = (hash(`${key}:lng`) % 1000) / 1000 - 0.5;
  return [a * spread, b * spread];
};

const toDate = (year, month) => {
  const date = new Date(Date.UTC(Number(year), monthIndex[month] ?? 0, 15, 12));
  return date.toISOString();
};

const csv = await fs.readFile(csvPath, 'utf8');
const rows = parseCsv(csv);
const latestYear = Math.max(...rows.map((row) => Number(row.Year)));
const latestRows = rows.filter((row) => Number(row.Year) === latestYear);
const latestMonthNumber = Math.max(...latestRows.map((row) => monthIndex[row.Month] ?? 0));
const latestMonthName = Object.keys(monthIndex).find((name) => monthIndex[name] === latestMonthNumber);
const mapRows = rows.filter((row) => Number(row.Year) >= latestYear - 1);

const monthlyStats = rows.map((row) => ({
  year: Number(row.Year),
  month: row.Month,
  unit: row['Unit Name'],
  totalCases: Number(row['Total Cases'] || 0),
  categories: Object.fromEntries(crimeTypes.map((type) => [type.id, Number(row[type.csv] || 0)]))
}));

const records = [];
for (const row of mapRows) {
  const location = locations[row['Unit Name']];
  if (!location) continue;

  for (const type of crimeTypes) {
    const count = Number(row[type.csv] || 0);
    if (count <= 0) continue;
    const key = `${row.Year}-${row.Month}-${row['Unit Name']}-${type.id}`;
    const [latOffset, lngOffset] = jitter(key);
    records.push({
      id: `csv-${row.Year}-${row.Month}-${location.unit.replace(/\s+/g, '-').toLowerCase()}-${type.id}`,
      type: type.id,
      typeName: type.name,
      typeNameBn: type.nameBn,
      crime_type_id: type.id,
      type_name: type.name,
      type_name_bn: type.nameBn,
      severity: type.severity,
      lat: Number((location.lat + latOffset).toFixed(6)),
      lng: Number((location.lng + lngOffset).toFixed(6)),
      latitude: Number((location.lat + latOffset).toFixed(6)),
      longitude: Number((location.lng + lngOffset).toFixed(6)),
      area: location.name,
      areaBn: location.nameBn,
      area_bn: location.nameBn,
      date: toDate(row.Year, row.Month),
      incident_date: toDate(row.Year, row.Month),
      title: `${type.name} cases in ${location.name}`,
      description: `${count.toLocaleString('en-US')} ${type.name.toLowerCase()} case${count === 1 ? '' : 's'} recorded by ${location.unit} in ${row.Month} ${row.Year}.`,
      reportedBy: 'Bangladesh Police crime statistics CSV',
      status: Number(row.Year) === latestYear && row.Month === latestMonthName ? 'latest' : 'historical',
      victims: Math.max(1, Math.round(Math.min(count, 999) / 25)),
      caseCount: count,
      source: 'Crime Statistics Of Bangladesh 2020-25.csv',
      unit: location.unit,
      color: type.color
    });
  }
}

const latestRecords = records.filter((record) => {
  const date = new Date(record.date);
  return date.getUTCFullYear() === latestYear && date.getUTCMonth() === latestMonthNumber;
});

const locationSummaries = Object.values(locations).map((location) => {
  const unitRows = rows.filter((row) => row['Unit Name'] === location.unit);
  const latest = unitRows.find((row) => Number(row.Year) === latestYear && row.Month === latestMonthName);
  const latestTotal = Number(latest?.['Total Cases'] || 0);
  const maxTotal = Math.max(...rows.map((row) => Number(row['Total Cases'] || 0)));
  const riskScore = Math.min(100, Math.round((latestTotal / maxTotal) * 100));
  return {
    id: location.unit.toLowerCase().replace(/\s+/g, '-'),
    name: location.name,
    namebn: location.nameBn,
    name_en: location.name,
    name_bn: location.nameBn,
    unit: location.unit,
    district: location.district,
    division: location.division,
    lat: location.lat,
    lng: location.lng,
    latitude: location.lat,
    longitude: location.lng,
    riskScore,
    risk_score: riskScore,
    crime_count: latestTotal,
    aliases: location.aliases
  };
});

const webOutput = `// Generated from data/crime-statistics-bangladesh-2020-25.csv. Run npm run data:crime to refresh.
export const bangladeshCrimeSource = ${JSON.stringify({
  file: 'data/crime-statistics-bangladesh-2020-25.csv',
  rows: rows.length,
  latestPeriod: `${latestMonthName} ${latestYear}`,
  mapPeriod: `${latestYear - 1}-${latestYear}`
}, null, 2)} as const;

export const bangladeshCrimeTypes = ${JSON.stringify(crimeTypes.map(({ csv, nameBn, ...type }) => ({ ...type, namebn: nameBn, csvLabel: csv })), null, 2)} as const;

export const bangladeshCrimeLocations = ${JSON.stringify(locationSummaries, null, 2)} as const;

export const bangladeshCrimeMonthlyStats = ${JSON.stringify(monthlyStats, null, 2)} as const;

export const bangladeshCrimeRecords = ${JSON.stringify(records, null, 2)} as const;

export const latestBangladeshCrimeRecords = ${JSON.stringify(latestRecords, null, 2)} as const;
`;

const mobileOutput = `// Generated from ../../data/crime-statistics-bangladesh-2020-25.csv. Run npm run data:crime to refresh.
import type { Area, Crime, CrimeType } from '../types';

export const fallbackCrimeSource = ${JSON.stringify({
  file: 'data/crime-statistics-bangladesh-2020-25.csv',
  rows: rows.length,
  latestPeriod: `${latestMonthName} ${latestYear}`
}, null, 2)} as const;

export const fallbackCrimeTypes: CrimeType[] = ${JSON.stringify(crimeTypes.map(({ csv, nameBn, severity, ...type }) => ({
  id: type.id,
  name_en: type.name,
  name_bn: nameBn,
  color: type.color,
  severity_base: severity
})), null, 2)};

export const fallbackAreas: Area[] = ${JSON.stringify(locationSummaries.map((location) => ({
  id: location.id,
  name_en: location.name_en,
  name_bn: location.name_bn,
  district: location.district,
  division: location.division,
  latitude: location.latitude,
  longitude: location.longitude,
  risk_score: location.risk_score,
  crime_count: location.crime_count
})), null, 2)};

export const fallbackCrimes: Crime[] = ${JSON.stringify(latestRecords.map((record) => ({
  id: record.id,
  crime_type_id: record.crime_type_id,
  type_name: record.type_name,
  type_name_bn: record.type_name_bn,
  title: record.title,
  description: record.description,
  latitude: record.latitude,
  longitude: record.longitude,
  incident_date: record.incident_date,
  severity: record.severity,
  status: record.status,
  area: record.area,
  area_bn: record.area_bn,
  color: record.color,
  caseCount: record.caseCount
})), null, 2)};
`;

await fs.writeFile(path.join(root, 'src/app/data/bangladeshCrimeStats.ts'), webOutput);
await fs.writeFile(path.join(root, 'mobile/src/data/bangladeshCrimeStats.ts'), mobileOutput);

console.log(`Generated ${records.length} web map records and ${latestRecords.length} mobile fallback records from ${rows.length} CSV rows.`);
