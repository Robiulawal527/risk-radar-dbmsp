import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Navbar from '../components/Navbar';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { FileText, Plus, CheckCircle, Clock, AlertCircle, Camera, MapPin } from 'lucide-react';
import { crimeTypes, dhakaAreas } from '../utils/crimeData';
import { toast } from 'sonner';

export default function Reports() {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'theft',
    area: 'Gulshan',
    description: '',
    location: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Mock user reports
    setReports([
      {
        id: 'rep-1',
        type: 'theft',
        area: 'Banani',
        description: 'Mobile phone snatched near park',
        status: 'investigating',
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'rep-2',
        type: 'assault',
        area: 'Dhanmondi',
        description: 'Witnessed street altercation',
        status: 'resolved',
        date: new Date(Date.now() - 86400000 * 7).toISOString(),
      },
      {
        id: 'rep-3',
        type: 'fraud',
        area: 'Gulshan',
        description: 'Online scam attempt via social media',
        status: 'pending',
        date: new Date(Date.now() - 86400000).toISOString(),
      },
    ]);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const newReport = {
      id: `rep-${Date.now()}`,
      ...formData,
      status: 'pending',
      date: new Date().toISOString(),
    };

    setReports([newReport, ...reports]);
    setShowForm(false);
    setFormData({
      type: 'theft',
      area: 'Gulshan',
      description: '',
      location: '',
    });

    toast.success(language === 'en' 
      ? '✅ Report submitted successfully! Authorities have been notified.'
      : '✅ রিপোর্ট সফলভাবে জমা দেওয়া হয়েছে! কর্তৃপক্ষকে অবহিত করা হয়েছে।'
    );
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="w-4 h-4" />;
      case 'investigating': return <Clock className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'investigating': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    if (language === 'en') {
      return status.charAt(0).toUpperCase() + status.slice(1);
    }
    switch (status) {
      case 'resolved': return 'সমাধান';
      case 'investigating': return 'তদন্তাধীন';
      default: return 'বিচারাধীন';
    }
  };

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {language === 'en' ? 'Crime Reports' : 'অপরাধ রিপোর্ট'}
            </h1>
            <p className="text-gray-600">
              {language === 'en' 
                ? 'Submit and track your crime reports'
                : 'আপনার অপরাধ রিপোর্ট জমা দিন এবং ট্র্যাক করুন'}
            </p>
          </div>

          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {language === 'en' ? 'New Report' : 'নতুন রিপোর্ট'}
          </Button>
        </div>

        {/* Report Form */}
        {showForm && (
          <Card className="p-6 animate-in slide-in-from-top-4 duration-300">
            <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-red-600" />
              <span>
                {language === 'en' ? 'Submit Crime Report' : 'অপরাধ রিপোর্ট জমা দিন'}
              </span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'en' ? 'Crime Type' : 'অপরাধের ধরন'}
                  </label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {crimeTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {language === 'en' ? type.name : type.namebn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'en' ? 'Area' : 'এলাকা'}
                  </label>
                  <Select
                    value={formData.area}
                    onValueChange={(value) => setFormData({ ...formData, area: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dhakaAreas.map(area => (
                        <SelectItem key={area.name} value={area.name}>
                          {language === 'en' ? area.name : area.namebn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'en' ? 'Specific Location' : 'নির্দিষ্ট অবস্থান'}
                </label>
                <Input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder={language === 'en' ? 'e.g., Near City Bank, Road 23' : 'যেমন, সিটি ব্যাংকের কাছে, রোড ২৩'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'en' ? 'Description' : 'বর্ণনা'}
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={language === 'en' 
                    ? 'Describe what happened in detail...'
                    : 'বিস্তারিতভাবে কী ঘটেছিল তা বর্ণনা করুন...'}
                  rows={4}
                  required
                />
              </div>

              <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Camera className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-blue-900">
                  {language === 'en' 
                    ? 'You can attach photos and evidence after submission'
                    : 'জমা দেওয়ার পরে আপনি ফটো এবং প্রমাণ সংযুক্ত করতে পারেন'}
                </p>
              </div>

              <div className="flex space-x-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {language === 'en' ? 'Submit Report' : 'রিপোর্ট জমা দিন'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="flex-1"
                >
                  {language === 'en' ? 'Cancel' : 'বাতিল'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Reports List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">
            {language === 'en' ? 'Your Reports' : 'আপনার রিপোর্ট'}
          </h2>

          {reports.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {language === 'en' ? 'No reports yet' : 'এখনও কোনো রিপোর্ট নেই'}
              </p>
            </Card>
          ) : (
            reports.map(report => {
              const crimeType = crimeTypes.find(t => t.id === report.type);
              
              return (
                <Card key={report.id} className="p-5 hover:shadow-lg transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: crimeType?.color }}
                        >
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">
                            {language === 'en' ? crimeType?.name : crimeType?.namebn}
                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <MapPin className="w-3 h-3" />
                            <span>{report.area}</span>
                            <span>•</span>
                            <span>{new Date(report.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-700 mt-2">{report.description}</p>
                      
                      {report.location && (
                        <p className="text-xs text-gray-500 mt-1">
                          📍 {report.location}
                        </p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-start space-x-2 sm:space-x-0 sm:space-y-2">
                      <Badge className={`${getStatusColor(report.status)} flex items-center space-x-1`}>
                        {getStatusIcon(report.status)}
                        <span>{getStatusLabel(report.status)}</span>
                      </Badge>
                      <Button variant="outline" size="sm">
                        {language === 'en' ? 'View Details' : 'বিস্তারিত'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
