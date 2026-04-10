import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Navbar from '../components/Navbar';
import InteractiveMap from '../components/InteractiveMap';
import FilterPanel, {
  type DashboardFilters,
} from '../components/FilterPanel';
import StatsPanel from '../components/StatsPanel';
import CrimeDetailsPanel from '../components/CrimeDetailsPanel';
import EmergencyButtons from '../components/EmergencyButtons';
import { generateCrimeData, type GeneratedCrime } from '../utils/crimeData';
import { useLocationMonitor, requestNotificationPermission } from '../hooks/useLocationMonitor';
import { Button } from '../components/ui/button';
import { Bell, BellOff } from 'lucide-react';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [crimes, setCrimes] = useState<GeneratedCrime[]>([]);
  const [filteredCrimes, setFilteredCrimes] = useState<GeneratedCrime[]>([]);
  const [selectedCrime, setSelectedCrime] = useState<GeneratedCrime | null>(
    null,
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>({
    crimeType: 'all',
    startDate: null,
    endDate: null,
    area: 'all',
  });

  // Enable location monitoring
  const { userLocation, currentRiskZone } = useLocationMonitor(notificationsEnabled ? crimes : []);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Generate mock crime data
    const crimeData = generateCrimeData();
    setCrimes(crimeData);
    setFilteredCrimes(crimeData);
  }, []);

  useEffect(() => {
    // Apply filters
    let filtered = [...crimes];

    if (filters.crimeType !== 'all') {
      filtered = filtered.filter(crime => crime.type === filters.crimeType);
    }

    if (filters.startDate) {
      filtered = filtered.filter(crime => new Date(crime.date) >= new Date(filters.startDate));
    }

    if (filters.endDate) {
      filtered = filtered.filter(crime => new Date(crime.date) <= new Date(filters.endDate));
    }

    if (filters.area !== 'all') {
      filtered = filtered.filter(crime => crime.area === filters.area);
    }

    setFilteredCrimes(filtered);
  }, [filters, crimes]);

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsEnabled(true);
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="p-4 md:p-6 space-y-4">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {language === 'en' ? `Welcome back, ${user?.fullName || user?.name}!` : `স্বাগতম, ${user?.fullName || user?.name}!`}
              </h1>
              <p className="opacity-90">
                {language === 'en' 
                  ? 'Stay informed about crime activity in your area' 
                  : 'আপনার এলাকার অপরাধ কার্যকলাপ সম্পর্কে সচেতন থাকুন'}
              </p>
            </div>
            
            {/* Notification Toggle */}
            <Button
              onClick={handleToggleNotifications}
              variant="secondary"
              className={`${notificationsEnabled ? 'bg-white text-red-600' : 'bg-white/20 text-white'}`}
            >
              {notificationsEnabled ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
              {language === 'en' 
                ? (notificationsEnabled ? 'Alerts ON' : 'Enable Alerts')
                : (notificationsEnabled ? 'সতর্কতা চালু' : 'সতর্কতা সক্রিয় করুন')}
            </Button>
          </div>
          
          {currentRiskZone && (
            <div className="mt-4 p-3 bg-white/10 backdrop-blur rounded-lg border border-white/20">
              <p className="text-sm">
                📍 {language === 'en' ? 'Current Area:' : 'বর্তমান এলাকা:'} <strong>{currentRiskZone}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Stats Panel */}
        <StatsPanel crimes={filteredCrimes} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Filters */}
          <div className="lg:col-span-1">
            <FilterPanel filters={filters} setFilters={setFilters} />
            <EmergencyButtons />
          </div>

          {/* Map */}
          <div className="lg:col-span-3 space-y-4">
            <InteractiveMap 
              crimes={filteredCrimes} 
              onCrimeSelect={setSelectedCrime}
            />
            
            {/* Crime Details */}
            {selectedCrime && (
              <CrimeDetailsPanel 
                crime={selectedCrime} 
                onClose={() => setSelectedCrime(null)} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}