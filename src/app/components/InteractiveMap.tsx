import { useEffect, useRef, useState, type FormEvent } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { MapPin, Layers, Navigation, Search } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  crimeTypes,
  searchCrimeLocation,
  type GeneratedCrime,
} from '../utils/crimeData';

type InteractiveMapProps = {
  crimes: GeneratedCrime[];
  onCrimeSelect: (crime: GeneratedCrime) => void;
};

export default function InteractiveMap({
  crimes,
  onCrimeSelect,
}: InteractiveMapProps) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const heatLayerRef = useRef(null);
  const markersRef = useRef([]);
  const searchLayerRef = useRef(null);
  const { language } = useLanguage();
  
  const [viewMode, setViewMode] = useState('heatmap'); // 'heatmap' or 'markers'
  const [userLocation, setUserLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchMessage, setSearchMessage] = useState('');

  useEffect(() => {
    if (!mapRef.current) return;

    // Wait a bit for the container to have dimensions
    const timeoutId = setTimeout(() => {
      if (!mapRef.current) return;

      // Initialize map centered on Dhaka
      const map = L.map(mapRef.current, {
        center: [23.685, 90.3563], // Bangladesh center
        zoom: 7,
        zoomControl: true,
      });

      // Add tile layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Force map to update its size
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
        }
      }, 100);

      // Get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            
            // Add user location marker
            const userIcon = L.divIcon({
              html: '<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg pulse"></div>',
              className: 'user-location-marker',
              iconSize: [16, 16],
            });
            
            L.marker([latitude, longitude], { icon: userIcon })
              .addTo(map)
              .bindPopup(language === 'en' ? 'Your Location' : 'আপনার অবস্থান');
          },
          (error) => {
            console.log('Location access denied');
          }
        );
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [language]);

  useEffect(() => {
    if (!mapInstanceRef.current || crimes.length === 0) return;

    // Ensure map has been properly sized
    const mapContainer = mapInstanceRef.current.getContainer();
    if (!mapContainer || mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
      // Container not ready yet, wait for next render
      return;
    }

    // Clear existing layers
    if (heatLayerRef.current) {
      mapInstanceRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    if (viewMode === 'heatmap') {
      // Create heatmap with a slight delay to ensure canvas is ready
      setTimeout(() => {
        if (!mapInstanceRef.current) return;
        
        // Create heatmap
        const maxCases = Math.max(...crimes.map((crime) => crime.caseCount || 1), 1);
        const heatData: [number, number, number][] = crimes.map(crime => {
          const countWeight = Math.sqrt((crime.caseCount || 1) / maxCases);
          const severityWeight = crime.severity / 5;
          const intensity = Math.max(0.15, Math.min(1, countWeight * 0.75 + severityWeight * 0.25));
          return [crime.lat, crime.lng, intensity];
        });

        try {
          heatLayerRef.current = L.heatLayer(heatData, {
            radius: 25,
            blur: 35,
            maxZoom: 17,
            max: 1.0,
            gradient: {
              0.0: '#3b82f6',
              0.3: '#fbbf24',
              0.5: '#f97316',
              0.7: '#ef4444',
              1.0: '#991b1b'
            }
          }).addTo(mapInstanceRef.current);
        } catch (error) {
          console.log('Heatmap layer initialization deferred');
        }
      }, 50);
    } else {
      // Create markers
      crimes.forEach(crime => {
        const crimeType = crimeTypes.find(t => t.id === crime.type);
        const color = crimeType?.color || '#ef4444';
        
        const icon = L.divIcon({
          html: `
            <div class="relative">
              <div class="w-8 h-8 rounded-full shadow-lg flex items-center justify-center" 
                   style="background-color: ${color};">
                <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                </svg>
              </div>
              <div class="absolute top-0 left-0 w-8 h-8 rounded-full animate-ping" 
                   style="background-color: ${color}; opacity: 0.4;"></div>
            </div>
          `,
          className: 'crime-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        const marker = L.marker([crime.lat, crime.lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div class="p-2">
              <h3 class="font-bold text-sm mb-1" style="color: ${color};">
                ${language === 'en' ? crime.typeName : crime.typeNameBn}
              </h3>
              <p class="text-xs text-gray-600">${crime.area}</p>
              <p class="text-xs text-gray-500 mt-1">
                ${new Date(crime.date).toLocaleDateString()}
              </p>
              <p class="text-xs text-gray-700 mt-1">
                ${crime.caseCount?.toLocaleString() || 1} cases
              </p>
              <button 
                class="text-xs text-blue-600 hover:underline mt-2"
                onclick="window.dispatchEvent(new CustomEvent('crimeSelect', { detail: '${crime.id}' }))"
              >
                ${language === 'en' ? 'View Details' : 'বিস্তারিত দেখুন'}
              </button>
            </div>
          `);
        
        markersRef.current.push(marker);
      });

      // Handle crime selection from popup
      const handleCrimeSelect = (e) => {
        const crime = crimes.find(c => c.id === e.detail);
        if (crime) onCrimeSelect(crime);
      };
      
      window.addEventListener('crimeSelect', handleCrimeSelect);
      return () => window.removeEventListener('crimeSelect', handleCrimeSelect);
    }
  }, [crimes, viewMode, language, onCrimeSelect]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (searchLayerRef.current) {
      searchLayerRef.current.remove();
      searchLayerRef.current = null;
    }

    if (!searchResult) return;

    const label = language === 'en' ? searchResult.name : searchResult.namebn;
    const marker = L.marker([searchResult.lat, searchResult.lng]).bindPopup(`
      <div style="font-family: system-ui; min-width: 180px;">
        <strong>${label}</strong>
        <div style="font-size: 12px; color: #475569; margin-top: 4px;">${searchResult.unit} • ${searchResult.district}</div>
        <div style="font-size: 12px; color: #dc2626; margin-top: 6px; font-weight: 700;">Risk score: ${searchResult.riskScore}/100</div>
      </div>
    `);
    const layer = L.layerGroup([
      L.circle([searchResult.lat, searchResult.lng], {
        radius: searchResult.unit.includes('Range') ? 45000 : 12000,
        color: '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: 0.12,
        weight: 2,
      }),
      marker,
    ]).addTo(mapInstanceRef.current);

    searchLayerRef.current = layer;
    marker.openPopup();
  }, [language, searchResult]);

  const handleLocationSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    let result: any = searchCrimeLocation(searchTerm);

    if (!result) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bd&q=${encodeURIComponent(searchTerm)}`,
        );
        const [place] = await response.json();
        if (place?.lat && place?.lon) {
          result = {
            name: place.display_name.split(',')[0],
            namebn: place.display_name.split(',')[0],
            lat: Number(place.lat),
            lng: Number(place.lon),
            unit: 'Map Search',
            district: 'Bangladesh',
            division: 'Bangladesh',
            aliases: [],
            riskScore: 0,
            latestCaseCount: 0,
          };
        }
      } catch {
        result = null;
      }
    }

    if (!result) {
      setSearchResult(null);
      setSearchMessage(
        language === 'en'
          ? 'No match found. Try Dhaka, Chattogram, Rajshahi, Rangpur, Sylhet, Gazipur, Railway, or another Bangladesh place.'
          : 'ম্যাচ পাওয়া যায়নি। ঢাকা, চট্টগ্রাম, রাজশাহী, রংপুর, সিলেট, গাজীপুর, রেলওয়ে বা বাংলাদেশের অন্য জায়গা লিখুন।',
      );
      return;
    }

    setSearchResult(result);
    setSearchMessage(`${language === 'en' ? result.name : result.namebn} • ${result.unit}`);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [result.lat, result.lng],
        result.unit.includes('Range') ? 8 : 11,
        { animate: true },
      );
    }
  };

  const locateUser = () => {
    if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 15);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
        }
      });
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Map Controls */}
      <div className="p-3 bg-white border-b flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <MapPin className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold">
            {language === 'en' ? 'Crime Map' : 'অপরাধ মানচিত্র'}
          </h3>
          <span className="text-sm text-gray-500">
            {crimes.length} {language === 'en' ? 'incidents' : 'ঘটনা'}
          </span>
        </div>

        <form
          onSubmit={handleLocationSearch}
          className="flex w-full flex-col gap-2 md:w-auto md:min-w-[360px]"
        >
          <div className="flex gap-2">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={language === 'en' ? 'Search location, range, district...' : 'লোকেশন, রেঞ্জ, জেলা খুঁজুন...'}
              className="h-9"
            />
            <Button type="submit" size="sm" className="bg-red-600 hover:bg-red-700">
              <Search className="w-4 h-4" />
              <span className="sr-only">{language === 'en' ? 'Search map' : 'ম্যাপে খুঁজুন'}</span>
            </Button>
          </div>
          {searchMessage && (
            <p className="text-xs text-gray-600">{searchMessage}</p>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-600">
              {language === 'en' ? 'Heatmap' : 'হিটম্যাপ'}
            </span>
            <Switch
              checked={viewMode === 'markers'}
              onCheckedChange={(checked) => setViewMode(checked ? 'markers' : 'heatmap')}
            />
            <span className="text-sm text-gray-600">
              {language === 'en' ? 'Markers' : 'মার্কার'}
            </span>
          </div>

          {/* Locate User Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={locateUser}
            className="flex items-center space-x-1"
          >
            <Navigation className="w-4 h-4" />
            <span className="hidden sm:inline">
              {language === 'en' ? 'My Location' : 'আমার অবস্থান'}
            </span>
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="w-full h-[500px] md:h-[600px]"
      />

      {/* Legend */}
      <div className="p-3 bg-gray-50 border-t">
        <div className="flex flex-wrap gap-3 text-xs">
          {crimeTypes.map(type => (
            <div key={type.id} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: type.color }}
              />
              <span>{language === 'en' ? type.name : type.namebn}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
