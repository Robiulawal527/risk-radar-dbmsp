import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Navbar from '../components/Navbar';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { User, Shield, Heart, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import { mockCriminals } from '../utils/crimeData';

export default function Profiles() {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading) return null;
  if (!user) return null;

  const getDangerColor = (level) => {
    if (level >= 4) return 'bg-red-600';
    if (level >= 3) return 'bg-orange-600';
    return 'bg-yellow-600';
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {language === 'en' ? 'Profiles & Rankings' : 'প্রোফাইল এবং র‍্যাঙ্কিং'}
          </h1>
          <p className="text-gray-600">
            {language === 'en' 
              ? 'View criminal profiles and community contributors'
              : 'অপরাধী প্রোফাইল এবং কমিউনিটি অবদানকারী দেখুন'}
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="criminals" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="criminals">
              <AlertTriangle className="w-4 h-4 mr-2" />
              {language === 'en' ? 'Criminals' : 'অপরাধী'}
            </TabsTrigger>
            <TabsTrigger value="victims">
              <Shield className="w-4 h-4 mr-2" />
              {language === 'en' ? 'Victims' : 'ভিকটিম'}
            </TabsTrigger>
            <TabsTrigger value="volunteers">
              <Heart className="w-4 h-4 mr-2" />
              {language === 'en' ? 'Volunteers' : 'স্বেচ্ছাসেবক'}
            </TabsTrigger>
          </TabsList>

          {/* Criminals Tab */}
          <TabsContent value="criminals" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Award className="w-5 h-5 text-red-600" />
                <h2 className="text-xl font-bold">
                  {language === 'en' ? 'Top Criminal Ranking' : 'শীর্ষ অপরাধী র‍্যাঙ্কিং'}
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                {language === 'en' 
                  ? 'Most wanted criminals by law enforcement agencies'
                  : 'আইন প্রয়োগকারী সংস্থা দ্বারা সবচেয়ে বেশি চাওয়া অপরাধী'}
              </p>

              <div className="space-y-4">
                {mockCriminals.map((criminal, index) => (
                  <div 
                    key={criminal.id}
                    className="p-4 rounded-lg border hover:shadow-md transition-shadow bg-gradient-to-r from-red-50 to-orange-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {/* Rank Badge */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' :
                          index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                          index === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-700' :
                          'bg-gray-600'
                        }`}>
                          #{index + 1}
                        </div>

                        {/* Criminal Info */}
                        <div>
                          <h3 className="font-bold text-lg flex items-center space-x-2">
                            <span>{criminal.name}</span>
                            <Badge variant="outline" className="text-xs">
                              "{criminal.alias}"
                            </Badge>
                          </h3>
                          <div className="flex items-center space-x-3 text-sm text-gray-600 mt-1">
                            <span>
                              {language === 'en' ? 'Crimes:' : 'অপরাধ:'} <strong>{criminal.crimesCommitted}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              {language === 'en' ? 'Last seen:' : 'শেষ দেখা:'} {criminal.lastSeen}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status & Danger Level */}
                      <div className="text-right space-y-2">
                        <Badge className="bg-red-600">
                          {criminal.status}
                        </Badge>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-600">
                            {language === 'en' ? 'Danger:' : 'বিপদ:'}
                          </span>
                          <div className="flex space-x-1">
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-6 rounded ${
                                  i < criminal.dangerLevel ? getDangerColor(criminal.dangerLevel) : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Victims Tab */}
          <TabsContent value="victims" className="space-y-4">
            <Card className="p-12 text-center">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">
                {language === 'en' ? 'Protected Content' : 'সুরক্ষিত বিষয়বস্তু'}
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                {language === 'en' 
                  ? 'Victim profiles are confidential and only accessible to authorized law enforcement personnel to ensure privacy and safety.'
                  : 'ভিকটিম প্রোফাইলগুলি গোপনীয় এবং গোপনীয়তা এবং নিরাপত্তা নিশ্চিত করতে শুধুমাত্র অনুমোদিত আইন প্রয়োগকারী কর্মীদের জন্য অ্যাক্সেসযোগ্য।'}
              </p>
            </Card>
          </TabsContent>

          {/* Volunteers Tab */}
          <TabsContent value="volunteers" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h2 className="text-xl font-bold">
                  {language === 'en' ? 'Top Community Contributors' : 'শীর্ষ কমিউনিটি অবদানকারী'}
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                {language === 'en' 
                  ? 'Citizens who have actively contributed to community safety'
                  : 'যে নাগরিকরা সক্রিয়ভাবে কমিউনিটি সুরক্ষায় অবদান রেখেছেন'}
              </p>

              <div className="space-y-3">
                {[
                  { name: 'Anonymous User 001', reports: 23, verified: 18, badge: 'Gold' },
                  { name: 'Anonymous User 002', reports: 19, verified: 15, badge: 'Silver' },
                  { name: 'Anonymous User 003', reports: 15, verified: 12, badge: 'Bronze' },
                  { name: 'Anonymous User 004', reports: 12, verified: 9, badge: 'Active' },
                  { name: 'Anonymous User 005', reports: 10, verified: 7, badge: 'Active' },
                ].map((volunteer, index) => (
                  <div 
                    key={index}
                    className="p-4 rounded-lg border hover:shadow-md transition-shadow bg-gradient-to-r from-green-50 to-emerald-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                          {volunteer.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold">{volunteer.name}</h3>
                          <p className="text-sm text-gray-600">
                            {volunteer.reports} {language === 'en' ? 'reports' : 'রিপোর্ট'} • 
                            {volunteer.verified} {language === 'en' ? 'verified' : 'যাচাইকৃত'}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${
                        volunteer.badge === 'Gold' ? 'bg-yellow-500' :
                        volunteer.badge === 'Silver' ? 'bg-gray-400' :
                        volunteer.badge === 'Bronze' ? 'bg-orange-600' :
                        'bg-green-600'
                      }`}>
                        {volunteer.badge}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Privacy Notice */}
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-900 font-semibold mb-1">
                    {language === 'en' ? 'Privacy Protected' : 'গোপনীয়তা সুরক্ষিত'}
                  </p>
                  <p className="text-xs text-blue-800">
                    {language === 'en' 
                      ? 'All volunteer identities are kept confidential. Only contribution statistics are displayed publicly.'
                      : 'সকল স্বেচ্ছাসেবক পরিচয় গোপন রাখা হয়। শুধুমাত্র অবদান পরিসংখ্যান প্রকাশ্যে প্রদর্শিত হয়।'}
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
