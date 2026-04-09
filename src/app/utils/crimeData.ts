// Mock crime data for Bangladesh (Dhaka focused)
export const crimeTypes = [
  { id: 'theft', name: 'Theft', namebn: 'চুরি', color: '#fbbf24', severity: 2 },
  { id: 'robbery', name: 'Robbery', namebn: 'ডাকাতি', color: '#f97316', severity: 4 },
  { id: 'assault', name: 'Assault', namebn: 'হামলা', color: '#ef4444', severity: 3 },
  { id: 'murder', name: 'Murder', namebn: 'খুন', color: '#991b1b', severity: 5 },
  { id: 'kidnapping', name: 'Kidnapping', namebn: 'অপহরণ', color: '#dc2626', severity: 5 },
  { id: 'fraud', name: 'Fraud', namebn: 'জালিয়াতি', color: '#fb923c', severity: 2 },
];

export const dhakaAreas = [
  { name: 'Gulshan', namebn: 'গুলশান', lat: 23.7808, lng: 90.4166, riskScore: 35 },
  { name: 'Banani', namebn: 'বনানী', lat: 23.7937, lng: 90.4066, riskScore: 32 },
  { name: 'Dhanmondi', namebn: 'ধানমন্ডি', lat: 23.7465, lng: 90.3763, riskScore: 42 },
  { name: 'Mirpur', namebn: 'মিরপুর', lat: 23.8223, lng: 90.3654, riskScore: 68 },
  { name: 'Uttara', namebn: 'উত্তরা', lat: 23.8759, lng: 90.3795, riskScore: 45 },
  { name: 'Mohammadpur', namebn: 'মোহাম্মদপুর', lat: 23.7656, lng: 90.3564, riskScore: 55 },
  { name: 'Motijheel', namebn: 'মতিঝিল', lat: 23.7334, lng: 90.4172, riskScore: 50 },
  { name: 'Tejgaon', namebn: 'তেজগাঁও', lat: 23.7645, lng: 90.3896, riskScore: 58 },
  { name: 'Badda', namebn: 'বাড্ডা', lat: 23.7808, lng: 90.4265, riskScore: 61 },
  { name: 'Rampura', namebn: 'রামপুরা', lat: 23.7588, lng: 90.4242, riskScore: 63 },
  { name: 'Khilgaon', namebn: 'খিলগাঁও', lat: 23.7516, lng: 90.4269, riskScore: 65 },
  { name: 'Jatrabari', namebn: 'যাত্রাবাড়ী', lat: 23.7106, lng: 90.4337, riskScore: 72 },
  { name: 'Old Dhaka', namebn: 'পুরান ঢাকা', lat: 23.7104, lng: 90.4074, riskScore: 78 },
  { name: 'Kamrangirchar', namebn: 'কামরাঙ্গীরচর', lat: 23.7211, lng: 90.3704, riskScore: 81 },
  { name: 'Lalbagh', namebn: 'লালবাগ', lat: 23.7196, lng: 90.3932, riskScore: 75 },
];

// Generate realistic crime incidents
const getRandomDate = (daysBack) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));
  return date;
};

const descriptions = {
  theft: [
    'Mobile phone snatching reported',
    'Motorcycle theft from parking',
    'Bag snatching incident',
    'Shop burglary during night',
    'ATM card fraud case',
  ],
  robbery: [
    'Armed robbery at local store',
    'Bank heist attempt foiled',
    'Residential robbery reported',
    'Jewelry store robbery',
    'Cash van robbery attempt',
  ],
  assault: [
    'Physical altercation reported',
    'Domestic violence case',
    'Street fight incident',
    'Assault on public transport',
    'Bar fight reported',
  ],
  murder: [
    'Homicide case under investigation',
    'Body found in abandoned building',
    'Gang-related violence',
    'Domestic dispute turned fatal',
    'Murder investigation ongoing',
  ],
  kidnapping: [
    'Child abduction reported',
    'Ransom demand case',
    'Missing person - suspected kidnapping',
    'Businessman kidnapped',
    'School student abduction attempt',
  ],
  fraud: [
    'Online scam reported',
    'Credit card fraud case',
    'Real estate fraud complaint',
    'Job scam investigation',
    'Investment fraud reported',
  ],
};

// Generate 300 mock crime incidents
export const generateCrimeData = () => {
  const crimes = [];
  for (let i = 0; i < 300; i++) {
    const type = crimeTypes[Math.floor(Math.random() * crimeTypes.length)];
    const area = dhakaAreas[Math.floor(Math.random() * dhakaAreas.length)];
    const date = getRandomDate(90); // Last 90 days
    
    // Add small random offset to coordinates
    const latOffset = (Math.random() - 0.5) * 0.02;
    const lngOffset = (Math.random() - 0.5) * 0.02;
    
    crimes.push({
      id: `crime-${i + 1}`,
      type: type.id,
      typeName: type.name,
      typeNameBn: type.namebn,
      severity: type.severity,
      lat: area.lat + latOffset,
      lng: area.lng + lngOffset,
      area: area.name,
      areaBn: area.namebn,
      date: date.toISOString(),
      description: descriptions[type.id][Math.floor(Math.random() * descriptions[type.id].length)],
      reportedBy: `Officer ${Math.floor(Math.random() * 100) + 1}`,
      status: ['investigating', 'resolved', 'pending'][Math.floor(Math.random() * 3)],
      victims: Math.floor(Math.random() * 3) + 1,
    });
  }
  return crimes;
};

// Calculate area risk scores based on crimes
export const calculateAreaRiskScore = (area, crimes) => {
  const areaCrimes = crimes.filter(c => c.area === area.name);
  if (areaCrimes.length === 0) return 0;
  
  const severitySum = areaCrimes.reduce((sum, crime) => sum + crime.severity, 0);
  const avgSeverity = severitySum / areaCrimes.length;
  const crimeCount = areaCrimes.length;
  
  // Risk score formula: weighted by severity and count
  const score = Math.min(100, (avgSeverity * 10 + crimeCount * 2));
  return Math.round(score);
};

// Criminal profiles (mock data)
export const mockCriminals = [
  {
    id: 'crim-1',
    name: 'Redacted Name 1',
    alias: 'The Shadow',
    crimesCommitted: 15,
    lastSeen: 'Mirpur Area',
    status: 'Wanted',
    dangerLevel: 5,
  },
  {
    id: 'crim-2',
    name: 'Redacted Name 2',
    alias: 'Night Rider',
    crimesCommitted: 12,
    lastSeen: 'Old Dhaka',
    status: 'Wanted',
    dangerLevel: 4,
  },
  {
    id: 'crim-3',
    name: 'Redacted Name 3',
    alias: 'Silent Wolf',
    crimesCommitted: 10,
    lastSeen: 'Jatrabari',
    status: 'Arrested',
    dangerLevel: 4,
  },
  {
    id: 'crim-4',
    name: 'Redacted Name 4',
    alias: 'Quick Hand',
    crimesCommitted: 8,
    lastSeen: 'Kamrangirchar',
    status: 'Wanted',
    dangerLevel: 3,
  },
  {
    id: 'crim-5',
    name: 'Redacted Name 5',
    alias: 'Smooth Talker',
    crimesCommitted: 7,
    lastSeen: 'Gulshan',
    status: 'Under Investigation',
    dangerLevel: 3,
  },
];

// AI-based crime prediction (mock)
export const predictCrimeHotspots = (crimes) => {
  // Group crimes by area
  const areaFrequency = {};
  crimes.forEach(crime => {
    areaFrequency[crime.area] = (areaFrequency[crime.area] || 0) + 1;
  });
  
  // Get top 5 areas with highest crime frequency
  const predictions = Object.entries(areaFrequency)
    .map(([area, count]) => ({
      area,
      predictedRisk: Math.min(100, count * 2),
      confidence: Math.floor(Math.random() * 20) + 75, // 75-95%
    }))
    .sort((a, b) => b.predictedRisk - a.predictedRisk)
    .slice(0, 5);
  
  return predictions;
};

// Safe route calculation (simplified)
export const calculateSafeRoute = (start, end, crimes) => {
  // In a real app, this would use routing API with crime data overlay
  return {
    routes: [
      {
        id: 'route-1',
        name: 'Safest Route',
        distance: '8.5 km',
        duration: '25 min',
        riskScore: 15,
        waypoints: [start, end],
      },
      {
        id: 'route-2',
        name: 'Fastest Route',
        distance: '6.2 km',
        duration: '18 min',
        riskScore: 42,
        waypoints: [start, end],
      },
      {
        id: 'route-3',
        name: 'Balanced Route',
        distance: '7.1 km',
        duration: '22 min',
        riskScore: 28,
        waypoints: [start, end],
      },
    ],
  };
};
