import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Navbar from '../components/Navbar';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Route, MapPin, Navigation, Shield, Clock, TrendingDown } from 'lucide-react';
import { calculateSafeRoute } from '../utils/crimeData';
import { toast } from 'sonner';

export default function SafeRoute() {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [routes, setRoutes] = useState(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleCalculate = (e) => {
    e.preventDefault();
    if (!startLocation || !endLocation) {
      toast.error(language === 'en' ? 'Please enter both locations' : 'দয়া করে উভয় অবস্থান লিখুন');
      return;
    }

    setCalculating(true);
    setTimeout(() => {
      const result = calculateSafeRoute(startLocation, endLocation, []);
      setRoutes(result.routes);
      setCalculating(false);
      toast.success(language === 'en' ? 'Safe routes calculated!' : 'নিরাপদ রুট গণনা করা হয়েছে!');
    }, 1500);
  };

  const getRiskColor = (score) => {
    if (score <= 20) return 'bg-green-500';
    if (score <= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getRiskLabel = (score) => {
    if (score <= 20) return language === 'en' ? 'Very Safe' : 'অত্যন্ত নিরাপদ';
    if (score <= 40) return language === 'en' ? 'Moderate Risk' : 'মধ্যম ঝুঁকি';
    return language === 'en' ? 'High Risk' : 'উচ্চ ঝুঁকি';
  };

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 mb-4">
            <Route className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {language === 'en' ? 'Safe Route Finder' : 'নিরাপদ রুট খুঁজুন'}
          </h1>
          <p className="text-gray-600">
            {language === 'en' 
              ? 'AI-powered navigation to avoid high-risk areas'
              : 'উচ্চ ঝুঁকিপূর্ণ এলাকা এড়াতে AI-চালিত নেভিগেশন'}
          </p>
        </div>

        {/* Route Calculator */}
        <Card className="p-6 max-w-2xl mx-auto">
          <form onSubmit={handleCalculate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-green-600" />
                <span>{language === 'en' ? 'Starting Location' : 'শুরুর অবস্থান'}</span>
              </label>
              <Input
                type="text"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                placeholder={language === 'en' ? 'Enter starting point (e.g., Gulshan)' : 'শুরুর বিন্দু লিখুন (যেমন, গুলশান)'}
                className="h-12"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-red-600" />
                <span>{language === 'en' ? 'Destination' : 'গন্তব্য'}</span>
              </label>
              <Input
                type="text"
                value={endLocation}
                onChange={(e) => setEndLocation(e.target.value)}
                placeholder={language === 'en' ? 'Enter destination (e.g., Mirpur)' : 'গন্তব্য লিখুন (যেমন, মিরপুর)'}
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              disabled={calculating}
            >
              {calculating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {language === 'en' ? 'Calculating...' : 'গণনা করা হচ্ছে...'}
                </>
              ) : (
                <>
                  <Route className="w-5 h-5 mr-2" />
                  {language === 'en' ? 'Find Safe Routes' : 'নিরাপদ রুট খুঁজুন'}
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Route Results */}
        {routes && (
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold text-center mb-6">
              {language === 'en' ? 'Available Routes' : 'উপলব্ধ রুট'}
            </h2>

            {routes.map((route, index) => (
              <Card 
                key={route.id}
                className={`p-6 hover:shadow-lg transition-all ${
                  index === 0 ? 'border-2 border-green-500 bg-green-50' : ''
                }`}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  {/* Route Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`p-2 rounded-lg ${
                        index === 0 ? 'bg-green-500' : 
                        index === 1 ? 'bg-blue-500' : 'bg-orange-500'
                      }`}>
                        <Route className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{route.name}</h3>
                        {index === 0 && (
                          <span className="text-sm text-green-600 font-semibold flex items-center space-x-1">
                            <Shield className="w-4 h-4" />
                            <span>{language === 'en' ? 'Recommended' : 'প্রস্তাবিত'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-xs text-gray-600">
                            {language === 'en' ? 'Distance' : 'দূরত্ব'}
                          </p>
                          <p className="font-semibold">{route.distance}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-xs text-gray-600">
                            {language === 'en' ? 'Duration' : 'সময়'}
                          </p>
                          <p className="font-semibold">{route.duration}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <TrendingDown className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-xs text-gray-600">
                            {language === 'en' ? 'Risk Level' : 'ঝুঁকি স্তর'}
                          </p>
                          <div className="flex items-center space-x-2">
                            <div className="w-12 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`${getRiskColor(route.riskScore)} h-2 rounded-full`}
                                style={{ width: `${route.riskScore}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold">{route.riskScore}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button 
                    className={`${
                      index === 0 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                    onClick={() => toast.success(language === 'en' ? 'Navigation started!' : 'নেভিগেশন শুরু হয়েছে!')}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Navigate' : 'নেভিগেট করুন'}
                  </Button>
                </div>

                {/* Risk Assessment */}
                <div className="mt-4 p-3 bg-white rounded-lg border">
                  <p className="text-sm">
                    <span className="font-semibold">
                      {language === 'en' ? 'Safety Assessment: ' : 'নিরাপত্তা মূল্যায়ন: '}
                    </span>
                    <span className={`font-bold ${
                      route.riskScore <= 20 ? 'text-green-600' : 
                      route.riskScore <= 40 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {getRiskLabel(route.riskScore)}
                    </span>
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
