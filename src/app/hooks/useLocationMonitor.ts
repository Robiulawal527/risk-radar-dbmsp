import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  calculateAreaRiskScore,
  dhakaAreas,
  type GeneratedCrime,
} from '../utils/crimeData';

type UserCoords = { lat: number; lng: number };

export const useLocationMonitor = (crimes: GeneratedCrime[]) => {
  const [userLocation, setUserLocation] = useState<UserCoords | null>(null);
  const [currentRiskZone, setCurrentRiskZone] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });

        // Check if user is in a high-risk zone
        const nearbyArea = findNearestArea(latitude, longitude);
        if (nearbyArea) {
          const riskScore = calculateAreaRiskScore(nearbyArea, crimes);
          
          if (riskScore >= 60 && currentRiskZone !== nearbyArea.name) {
            // User entered a high-risk zone
            setCurrentRiskZone(nearbyArea.name);
            toast.warning(
              `⚠️ Warning: You are entering a high-risk area (${nearbyArea.name}). Risk Score: ${riskScore}/100. Stay alert!`,
              {
                duration: 8000,
                action: {
                  label: 'View Safe Routes',
                  onClick: () => window.location.href = '/safe-route',
                },
              }
            );

            // Optionally trigger notification API
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Risk Radar Alert', {
                body: `You are entering ${nearbyArea.name} - High Risk Zone (${riskScore}/100)`,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
              });
            }
          } else if (riskScore < 60 && currentRiskZone) {
            // User left high-risk zone
            setCurrentRiskZone(null);
            toast.success(`✅ You have left the high-risk area. Current area is safer.`);
          }
        }
      },
      (error) => {
        // Silently handle location errors - they're expected in environments without GPS
        if (error.code === error.PERMISSION_DENIED) {
          // User denied location permission - this is normal
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          // Location information unavailable
        } else if (error.code === error.TIMEOUT) {
          // Request timeout
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 27000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [crimes, currentRiskZone]);

  return { userLocation, currentRiskZone };
};

type DhakaArea = (typeof dhakaAreas)[number];

// Helper function to find nearest area
const findNearestArea = (lat: number, lng: number): DhakaArea | null => {
  let nearestArea: DhakaArea | null = null;
  let minDistance = Infinity;

  dhakaAreas.forEach(area => {
    const distance = getDistance(lat, lng, area.lat, area.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestArea = area;
    }
  });

  // Return area only if within 2km
  return minDistance < 2 ? nearestArea : null;
};

// Calculate distance between two coordinates (in km)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg: number) => {
  return deg * (Math.PI / 180);
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
};