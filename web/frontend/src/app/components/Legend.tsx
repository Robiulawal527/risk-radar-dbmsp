import { Info } from 'lucide-react';

export function Legend() {
  const levels = [
    { color: '#22c55e', label: 'Low Risk', range: '0-20%', description: 'Safe zone' },
    { color: '#eab308', label: 'Moderate', range: '20-40%', description: 'Caution advised' },
    { color: '#f97316', label: 'High Risk', range: '40-60%', description: 'Stay alert' },
    { color: '#ef4444', label: 'Very High', range: '60-80%', description: 'Avoid if possible' },
    { color: '#dc2626', label: 'Critical', range: '80-100%', description: 'Dangerous zone' }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg h-full">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
          <Info className="w-4 h-4 text-white" />
        </div>
        <div className="text-lg font-bold text-gray-900">
          Risk Levels
        </div>
      </div>

      <div className="space-y-4">
        {levels.map((level, index) => (
          <div key={level.label} className="group">
            <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="relative pt-1">
                <div
                  className="w-5 h-5 rounded-full shadow-lg transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: level.color,
                    boxShadow: `0 4px 12px ${level.color}40`
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-gray-900">{level.label}</div>
                  <div className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {level.range}
                  </div>
                </div>
                <div className="text-xs text-gray-600">{level.description}</div>
              </div>
            </div>
            {index < levels.length - 1 && (
              <div className="ml-5 my-2 h-6 w-px bg-gradient-to-b from-gray-200 to-transparent" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="text-xs text-gray-500 leading-relaxed">
          Risk levels are calculated based on incident density, severity, and frequency in each area.
        </div>
      </div>
    </div>
  );
}
