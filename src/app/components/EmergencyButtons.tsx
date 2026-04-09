import { Card } from './ui/card';
import { Button } from './ui/button';
import { AlertTriangle, Phone, Shield } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { toast } from 'sonner';

export default function EmergencyButtons() {
  const { language } = useLanguage();

  const handleSOS = () => {
    // In production, this would trigger real emergency services
    toast.error(language === 'en' 
      ? '🚨 Emergency alert sent! Police notified of your location.' 
      : '🚨 জরুরি সতর্কতা পাঠানো হয়েছে! পুলিশকে আপনার অবস্থান জানানো হয়েছে।'
    );
    
    // Simulate emergency call
    if (confirm(language === 'en' 
      ? 'Call emergency services (999)?'
      : 'জরুরি সেবা (৯৯৯) কল করবেন?'
    )) {
      window.location.href = 'tel:999';
    }
  };

  const handleFeelingUnsafe = () => {
    toast.warning(language === 'en'
      ? '⚠️ Your location has been shared with your emergency contacts.'
      : '⚠️ আপনার অবস্থান জরুরি যোগাযোগে শেয়ার করা হয়েছে।'
    );
  };

  const handleReportCrime = () => {
    toast.success(language === 'en'
      ? '📝 Crime report form opened.'
      : '📝 অপরাধ রিপোর্ট ফর্ম খোলা হয়েছে।'
    );
  };

  return (
    <Card className="p-4 mt-4 space-y-3">
      <h3 className="font-semibold text-sm mb-3">
        {language === 'en' ? 'Emergency Actions' : 'জরুরি পদক্ষেপ'}
      </h3>

      {/* SOS Button */}
      <Button
        onClick={handleSOS}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold h-12 animate-pulse"
      >
        <Phone className="w-5 h-5 mr-2" />
        {language === 'en' ? 'SOS Emergency (999)' : 'জরুরি SOS (৯৯৯)'}
      </Button>

      {/* Feeling Unsafe Button */}
      <Button
        onClick={handleFeelingUnsafe}
        variant="outline"
        className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 font-semibold h-12"
      >
        <AlertTriangle className="w-5 h-5 mr-2" />
        {language === 'en' ? 'Feeling Unsafe' : 'অনিরাপদ বোধ করছি'}
      </Button>

      {/* Report Crime Button */}
      <Button
        onClick={handleReportCrime}
        variant="outline"
        className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 font-semibold h-12"
      >
        <Shield className="w-5 h-5 mr-2" />
        {language === 'en' ? 'Report Crime' : 'অপরাধ রিপোর্ট করুন'}
      </Button>

      {/* Emergency Contact Info */}
      <div className="pt-3 border-t text-xs text-gray-600 space-y-1">
        <p><strong>{language === 'en' ? 'Emergency:' : 'জরুরি:'}</strong> 999</p>
        <p><strong>{language === 'en' ? 'Police:' : 'পুলিশ:'}</strong> 100</p>
        <p><strong>{language === 'en' ? 'Fire Service:' : 'ফায়ার সার্ভিস:'}</strong> 101</p>
      </div>
    </Card>
  );
}
