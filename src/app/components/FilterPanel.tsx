import { Card } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Filter, RotateCcw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { crimeTypes, dhakaAreas } from '../utils/crimeData';

export default function FilterPanel({ filters, setFilters }) {
  const { language, t } = useLanguage();

  const handleReset = () => {
    setFilters({
      crimeType: 'all',
      startDate: null,
      endDate: null,
      area: 'all',
    });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <Filter className="w-5 h-5 text-red-600" />
        <h3 className="font-semibold">{t('filters')}</h3>
      </div>

      {/* Crime Type Filter */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t('crimeType')}
        </label>
        <Select
          value={filters.crimeType}
          onValueChange={(value) => setFilters({ ...filters, crimeType: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('allTypes')}
            </SelectItem>
            {crimeTypes.map(type => (
              <SelectItem key={type.id} value={type.id}>
                {language === 'en' ? type.name : type.namebn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Area Filter */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t('area')}
        </label>
        <Select
          value={filters.area}
          onValueChange={(value) => setFilters({ ...filters, area: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {language === 'en' ? 'All Areas' : 'সব এলাকা'}
            </SelectItem>
            {dhakaAreas.map(area => (
              <SelectItem key={area.name} value={area.name}>
                {language === 'en' ? area.name : area.namebn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Range Filter */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {language === 'en' ? 'Start Date' : 'শুরুর তারিখ'}
        </label>
        <Input
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          {language === 'en' ? 'End Date' : 'শেষ তারিখ'}
        </label>
        <Input
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          max={new Date().toISOString().split('T')[0]}
          min={filters.startDate || ''}
        />
      </div>

      {/* Reset Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleReset}
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        {t('resetFilters')}
      </Button>

      {/* Active Filters Count */}
      <div className="pt-3 border-t text-center">
        <p className="text-sm text-gray-600">
          {language === 'en' ? 'Active Filters:' : 'সক্রিয় ফিল্টার:'}{' '}
          <span className="font-semibold text-red-600">
            {Object.values(filters).filter(v => v && v !== 'all').length}
          </span>
        </p>
      </div>
    </Card>
  );
}
