// Context for managing language (English/Bangla)
import { createContext, useContext, useState, ReactNode } from 'react';

interface LanguageContextType {
  language: string;
  setLanguage: React.Dispatch<React.SetStateAction<string>>;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    admin: 'Admin',
    analytics: 'Analytics',
    safeRoute: 'Safe Route',
    reports: 'Reports',
    profiles: 'Profiles',
    logout: 'Logout',
    login: 'Login',
    signup: 'Sign Up',
    
    // Dashboard
    crimeHeatmap: 'Crime Heatmap',
    filters: 'Filters',
    crimeType: 'Crime Type',
    dateRange: 'Date Range',
    area: 'Area',
    allTypes: 'All Types',
    applyFilters: 'Apply Filters',
    resetFilters: 'Reset Filters',
    
    // Crime Types
    theft: 'Theft',
    robbery: 'Robbery',
    assault: 'Assault',
    murder: 'Murder',
    kidnapping: 'Kidnapping',
    fraud: 'Fraud',
    
    // Stats
    totalCrimes: 'Total Crimes',
    highRiskZones: 'High Risk Zones',
    recentIncidents: 'Recent Incidents',
    avgRiskScore: 'Avg Risk Score',
    
    // Buttons
    sos: 'SOS Emergency',
    feelingUnsafe: 'Feeling Unsafe',
    reportCrime: 'Report Crime',
    findSafeRoute: 'Find Safe Route',
    
    // Messages
    welcome: 'Welcome to Risk Radar',
    tagline: 'See the risk. Avoid the danger. Stay ahead.',
  },
  bn: {
    // Navigation
    dashboard: 'ড্যাশবোর্ড',
    admin: 'অ্যাডমিন',
    analytics: 'বিশ্লেষণ',
    safeRoute: 'নিরাপদ রুট',
    reports: 'রিপোর্ট',
    profiles: 'প্রোফাইল',
    logout: 'লগআউট',
    login: 'লগইন',
    signup: 'সাইন আপ',
    
    // Dashboard
    crimeHeatmap: 'অপরাধ হিটম্যাপ',
    filters: 'ফিল্টার',
    crimeType: 'অপরাধের ধরন',
    dateRange: 'তারিখ সীমা',
    area: 'এলাকা',
    allTypes: 'সব ধরনের',
    applyFilters: 'ফিল্টার প্রয়োগ করুন',
    resetFilters: 'ফিল্টার রিসেট করুন',
    
    // Crime Types
    theft: 'চুরি',
    robbery: 'ডাকাতি',
    assault: 'হামলা',
    murder: 'খুন',
    kidnapping: 'অপহরণ',
    fraud: 'জালিয়াতি',
    
    // Stats
    totalCrimes: 'মোট অপরাধ',
    highRiskZones: 'উচ্চ ঝুঁকি এলাকা',
    recentIncidents: 'সাম্প্রতিক ঘটনা',
    avgRiskScore: 'গড় ঝুঁকি স্কোর',
    
    // Buttons
    sos: 'জরুরি SOS',
    feelingUnsafe: 'অনিরাপদ বোধ করছি',
    reportCrime: 'অপরাধ রিপোর্ট করুন',
    findSafeRoute: 'নিরাপদ রুট খুঁজুন',
    
    // Messages
    welcome: 'রিস্ক রাডারে স্বাগতম',
    tagline: 'ঝুঁকি দেখুন। বিপদ এড়িয়ে চলুন। এগিয়ে থাকুন।',
  },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState('en');

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'bn' : 'en');
  };

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
