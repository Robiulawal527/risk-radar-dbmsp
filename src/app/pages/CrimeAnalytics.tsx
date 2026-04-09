import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Navbar from '../components/Navbar';
import { Card } from '../components/ui/card';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, MapPin, Target, Brain } from 'lucide-react';
import { generateCrimeData, crimeTypes, dhakaAreas, predictCrimeHotspots, calculateAreaRiskScore } from '../utils/crimeData';

export default function CrimeAnalytics() {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [crimes, setCrimes] = useState([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const crimeData = generateCrimeData();
    setCrimes(crimeData);
  }, []);

  // Crime type distribution
  const crimeTypeData = crimeTypes.map(type => ({
    id: type.id,
    name: language === 'en' ? type.name : type.namebn,
    value: crimes.filter(c => c.type === type.id).length,
    color: type.color,
  }));

  // Monthly trend
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthCrimes = crimes.filter(c => {
      const crimeDate = new Date(c.date);
      return crimeDate.getMonth() === date.getMonth() && 
             crimeDate.getFullYear() === date.getFullYear();
    });
    monthlyData.push({
      id: `month-${date.getFullYear()}-${date.getMonth()}`, // Add unique ID
      month: date.toLocaleDateString(language === 'en' ? 'en-US' : 'bn-BD', { month: 'short' }),
      crimes: monthCrimes.length,
    });
  }

  // Top risk areas
  const areaRiskData = dhakaAreas
    .map((area, idx) => ({
      id: `area-${area.name}-${idx}`, // Add unique ID
      name: language === 'en' ? area.name : area.namebn,
      riskScore: calculateAreaRiskScore(area, crimes),
      crimeCount: crimes.filter(c => c.area === area.name).length,
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);

  // AI Predictions
  const predictions = predictCrimeHotspots(crimes);

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {language === 'en' ? 'Crime Analytics & Trends' : 'অপরাধ বিশ্লেষণ এবং ট্রেন্ড'}
          </h1>
          <p className="text-gray-600">
            {language === 'en' 
              ? 'Advanced analytics and AI-powered predictions' 
              : 'উন্নত বিশ্লেষণ এবং AI-চালিত ভবিষ্যদ্বাণী'}
          </p>
        </div>

        {/* Crime Trend Chart */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-bold">
              {language === 'en' ? 'Crime Trend Analysis' : 'অপরাধ ট্রেন্ড বিশ্লেষণ'}
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="crimes" 
                stroke="#ef4444" 
                strokeWidth={3}
                name={language === 'en' ? 'Crime Incidents' : 'অপরাধ ঘটনা'}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Crime Type Distribution */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">
              {language === 'en' ? 'Crime Type Distribution' : 'অপরাধ ধরন বিতরণ'}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={crimeTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {crimeTypeData.map((entry) => (
                    <Cell key={`cell-${entry.id}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Top Risk Areas */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <MapPin className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-bold">
                {language === 'en' ? 'Top Risk Areas' : 'শীর্ষ ঝুঁকি এলাকা'}
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={areaRiskData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar 
                  dataKey="riskScore" 
                  fill="#f97316"
                  name={language === 'en' ? 'Risk Score' : 'ঝুঁকি স্কোর'}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* AI Predictions */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Brain className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold">
              {language === 'en' ? 'AI Crime Predictions' : 'AI অপরাধ ভবিষ্যদ্বাণী'}
            </h2>
          </div>
          <p className="text-gray-600 mb-4">
            {language === 'en' 
              ? 'Machine learning analysis predicts these areas are at highest risk in the next 30 days:'
              : 'মেশিন লার্নিং বিশ্লেষণ ভবিষ্যদ্বাণী করে এই এলাকাগুলি পরবর্তী ৩০ দিনে সর্বোচ্চ ঝুঁকিতে রয়েছে:'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {predictions.map((pred, index) => (
              <div 
                key={`prediction-${pred.area}-${index}`}
                className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-600">
                    #{index + 1}
                  </span>
                </div>
                <h3 className="font-bold text-lg mb-1">{pred.area}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {language === 'en' ? 'Risk:' : 'ঝুঁকি:'}
                    </span>
                    <span className="font-semibold text-red-600">
                      {pred.predictedRisk}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {language === 'en' ? 'Confidence:' : 'নিশ্চিততা:'}
                    </span>
                    <span className="font-semibold text-green-600">
                      {pred.confidence}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Area Safety Ranking */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">
            {language === 'en' ? 'Area Safety Ranking System' : 'এলাকা সুরক্ষা র‍্যাঙ্কিং সিস্টেম'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">{language === 'en' ? 'Rank' : 'র‍্যাঙ্ক'}</th>
                  <th className="px-4 py-3 text-left">{language === 'en' ? 'Area' : 'এলাকা'}</th>
                  <th className="px-4 py-3 text-left">{language === 'en' ? 'Incidents' : 'ঘটনা'}</th>
                  <th className="px-4 py-3 text-left">{language === 'en' ? 'Risk Score' : 'ঝুঁকি স্কোর'}</th>
                  <th className="px-4 py-3 text-left">{language === 'en' ? 'Safety Grade' : 'সুরক্ষা গ্রেড'}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {areaRiskData.map((area, index) => {
                  const grade = area.riskScore >= 70 ? 'F' : area.riskScore >= 60 ? 'D' : area.riskScore >= 50 ? 'C' : area.riskScore >= 40 ? 'B' : 'A';
                  const gradeColor = area.riskScore >= 70 ? 'bg-red-600' : area.riskScore >= 60 ? 'bg-orange-600' : area.riskScore >= 50 ? 'bg-yellow-600' : area.riskScore >= 40 ? 'bg-blue-600' : 'bg-green-600';
                  
                  return (
                    <tr key={area.id}>
                      <td className="px-4 py-3 font-semibold">#{index + 1}</td>
                      <td className="px-4 py-3 font-medium">{area.name}</td>
                      <td className="px-4 py-3">{area.crimeCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-red-600 h-2 rounded-full" 
                              style={{ width: `${area.riskScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold">{area.riskScore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-white font-bold ${gradeColor}`}>
                          {grade}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}