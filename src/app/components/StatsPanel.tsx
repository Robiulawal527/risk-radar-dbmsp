import { Card } from './ui/card';
import { TrendingUp, AlertTriangle, Activity, Target } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  calculateAreaRiskScore,
  crimeDataSource,
  dhakaAreas,
  type GeneratedCrime,
} from '../utils/crimeData';

export default function StatsPanel({ crimes }: { crimes: GeneratedCrime[] }) {
  const { language, t } = useLanguage();

  // Calculate statistics
  const totalCrimes = crimes.reduce((sum, crime) => sum + (crime.caseCount || 1), 0);
  
  const highRiskZones = dhakaAreas.filter(area => {
    const score = calculateAreaRiskScore(area, crimes);
    return score >= 60;
  }).length;

  const latestPeriodCases = crimes
    .filter((crime) => crime.status === 'latest')
    .reduce((sum, crime) => sum + (crime.caseCount || 1), 0);

  const avgRiskScore = Math.round(
    dhakaAreas.reduce((sum, area) => sum + calculateAreaRiskScore(area, crimes), 0) / dhakaAreas.length
  );

  const stats = [
    {
      title: t('totalCrimes'),
      titlebn: 'মোট অপরাধ',
      value: totalCrimes,
      icon: Activity,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: t('highRiskZones'),
      titlebn: 'উচ্চ ঝুঁকি এলাকা',
      value: highRiskZones,
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
    },
    {
      title: t('recentIncidents'),
      titlebn: 'সাম্প্রতিক ঘটনা',
      value: latestPeriodCases,
      suffix: language === 'en' ? `(${crimeDataSource.latestPeriod})` : '(সর্বশেষ)',
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
    {
      title: t('avgRiskScore'),
      titlebn: 'গড় ঝুঁকি স্কোর',
      value: avgRiskScore,
      suffix: '/100',
      icon: Target,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">
                {language === 'en' ? stat.title : stat.titlebn}
              </p>
              <p className="text-3xl font-bold mb-1">
                {stat.value}
                {stat.suffix && (
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    {stat.suffix}
                  </span>
                )}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
