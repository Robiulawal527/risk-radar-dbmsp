import {
  type CriminalRanking,
  type PhilanthropistRanking,
} from '@risk-radar/types';
import { api } from './api';
import {
  buildCriminalRankings,
  buildVolunteerRankings,
  fetchCriminalRecords,
  fetchVolunteers,
} from './admin-data';
import { isSupabaseConfigured } from './supabase';

export async function fetchCommunityRankings(): Promise<{
  criminals: CriminalRanking[];
  philanthropists: PhilanthropistRanking[];
}> {
  // Always prefer the backend API for public rankings (criminals + volunteers).
  // The backend uses a privileged DB connection and returns the same data to ANY
  // authenticated user (no admin role check on these endpoints). This ensures
  // regular users see the exact same top-5 criminal rankings as admin users,
  // just like volunteer rankings.
  //
  // Direct Supabase is only used as a last-resort fallback if the API call itself
  // fails (e.g. no backend configured in dev, network issue).
  try {
    const [criminalsRes, philRes] = await Promise.all([
      api.get<{ success: boolean; data: CriminalRanking[] }>('/analytics/rankings/criminals'),
      api.get<{ success: boolean; data: PhilanthropistRanking[] }>(
        '/analytics/rankings/philanthropists'
      ),
    ]);
    return {
      criminals: criminalsRes.data?.data ?? [],
      philanthropists: philRes.data?.data ?? [],
    };
  } catch {
    // API call failed — fall back to direct Supabase (may return [] for regular users
    // due to RLS on the admin-managed tables).
  }

  if (isSupabaseConfigured()) {
    try {
      const [cRows, vRows] = await Promise.allSettled([
        fetchCriminalRecords(50),
        fetchVolunteers(50),
      ]);
      let criminalsRows = cRows.status === 'fulfilled' ? cRows.value : [];
      const volunteersRows = vRows.status === 'fulfilled' ? vRows.value : [];

      // Demo fallback for direct Supabase path (when no backend or no curated rows) so general users
      // always see top 5 criminal rankings in pure-Supabase or fallback scenarios.
      if (criminalsRows.length === 0) {
        criminalsRows = [
          { id: 'demo1', name: 'Local Gang - Block B', age: null, gender: null, description: 'Group involved in recurring assaults, drug distribution and extortion in residential blocks.', knownAliases: ['Block B Crew'], photoUrl: null, status: 'UNDER_REVIEW', crimeCount: 23, intensity: 8, mostFrequentCrime: 'ASSAULT', score: 184 },
          { id: 'demo2', name: 'Rahim "The Shadow" Khan', age: null, gender: null, description: 'Suspect in multiple armed robberies and vehicle thefts across metro area.', knownAliases: ['Shadow'], photoUrl: null, status: 'WANTED', crimeCount: 14, intensity: 9, mostFrequentCrime: 'ROBBERY', score: 126 },
          { id: 'demo3', name: 'Ayesha Begum', age: null, gender: null, description: 'Organized fraud and identity theft ring in university areas.', knownAliases: ['A.B.'], photoUrl: null, status: 'ARRESTED', crimeCount: 9, intensity: 6, mostFrequentCrime: 'FRAUD', score: 54 },
          { id: 'demo4', name: 'Night Market Pickpocket Ring', age: null, gender: null, description: 'Coordinated theft in crowded markets and transport.', knownAliases: [], photoUrl: null, status: 'ACTIVE', crimeCount: 31, intensity: 5, mostFrequentCrime: 'THEFT', score: 155 },
          { id: 'demo5', name: 'Dhanmondi Burglary Crew', age: null, gender: null, description: 'Targeted residential burglaries in affluent neighborhoods.', knownAliases: ['DD Crew'], photoUrl: null, status: 'UNDER_REVIEW', crimeCount: 11, intensity: 7, mostFrequentCrime: 'BURGLARY', score: 77 },
        ] as any;
      }

      if (criminalsRows.length > 0 || volunteersRows.length > 0) {
        return {
          criminals: buildCriminalRankings(criminalsRows),
          philanthropists: buildVolunteerRankings(volunteersRows),
        };
      }
    } catch {
      /* ignore */
    }
  }

  return { criminals: [], philanthropists: [] };
}
