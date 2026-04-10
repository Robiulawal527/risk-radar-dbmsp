import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, MapPin, Clock, AlertCircle, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { crimeTypes, type GeneratedCrime } from '../utils/crimeData';

type CrimeDetailsPanelProps = {
  crime: GeneratedCrime;
  onClose: () => void;
};

export default function CrimeDetailsPanel({
  crime,
  onClose,
}: CrimeDetailsPanelProps) {
  const { language } = useLanguage();

  const crimeType = crimeTypes.find(t => t.id === crime.type);
  
  const getSeverityColor = (severity) => {
    if (severity >= 4) return 'bg-red-600';
    if (severity >= 3) return 'bg-orange-600';
    return 'bg-yellow-600';
  };

  const getSeverityLabel = (severity) => {
    if (severity >= 4) return language === 'en' ? 'Critical' : 'সঙ্কটপূর্ণ';
    if (severity >= 3) return language === 'en' ? 'High' : 'উচ্চ';
    if (severity >= 2) return language === 'en' ? 'Medium' : 'মধ্যম';
    return language === 'en' ? 'Low' : 'নিম্ন';
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

  return (
    <Card className="p-6 relative animate-in slide-in-from-bottom-4 duration-300">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center space-x-3 mb-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: crimeType?.color }}
          >
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold">
              {language === 'en' ? crime.typeName : crime.typeNameBn}
            </h3>
            <div className="flex items-center space-x-2 mt-1">
              <Badge className={getSeverityColor(crime.severity)}>
                {getSeverityLabel(crime.severity)}
              </Badge>
              <Badge className={getStatusColor(crime.status)}>
                {getStatusLabel(crime.status)}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Location */}
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <MapPin className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {language === 'en' ? 'Location' : 'অবস্থান'}
              </p>
              <p className="font-semibold">
                {language === 'en' ? crime.area : crime.areaBn}
              </p>
              <p className="text-xs text-gray-500">
                {crime.lat.toFixed(4)}, {crime.lng.toFixed(4)}
              </p>
            </div>
          </div>

          {/* Date & Time */}
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {language === 'en' ? 'Date & Time' : 'তারিখ ও সময়'}
              </p>
              <p className="font-semibold">
                {new Date(crime.date).toLocaleDateString(language === 'en' ? 'en-US' : 'bn-BD')}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(crime.date).toLocaleTimeString(language === 'en' ? 'en-US' : 'bn-BD')}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
          <FileText className="w-5 h-5 text-gray-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">
              {language === 'en' ? 'Description' : 'বর্ণনা'}
            </p>
            <p className="text-sm">{crime.description}</p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-gray-600">
              {language === 'en' ? 'Victims' : 'ভিকটিম'}
            </p>
            <p className="font-semibold">{crime.victims}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">
              {language === 'en' ? 'Reported By' : 'রিপোর্ট করেছেন'}
            </p>
            <p className="font-semibold">{crime.reportedBy}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2 mt-6 pt-4 border-t">
        <Button variant="outline" className="flex-1">
          {language === 'en' ? 'View Full Report' : 'সম্পূর্ণ রিপোর্ট দেখুন'}
        </Button>
        <Button className="flex-1 bg-red-600 hover:bg-red-700">
          {language === 'en' ? 'Report Similar Crime' : 'অনুরূপ অপরাধ রিপোর্ট করুন'}
        </Button>
      </div>
    </Card>
  );
}
