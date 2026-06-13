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
  if (isSupabaseConfigured()) {
    try {
      const [cRows, vRows] = await Promise.allSettled([
        fetchCriminalRecords(50),
        fetchVolunteers(50),
      ]);
      const criminalsRows = cRows.status === 'fulfilled' ? cRows.value : [];
      const volunteersRows = vRows.status === 'fulfilled' ? vRows.value : [];
      if (criminalsRows.length > 0 || volunteersRows.length > 0) {
        return {
          criminals: buildCriminalRankings(criminalsRows),
          philanthropists: buildVolunteerRankings(volunteersRows),
        };
      }
    } catch {
      /* Fall back to the API so older deployments still work. */
    }
  }

  // API fallback (backend may use different table names; we defensively ?? [])
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
    // If both Supabase admin tables and backend rankings fail (e.g. not logged in during dev, or no data/backend down),
    // return empty so UI can render graceful empty states instead of crashing the tab.
    return { criminals: [], philanthropists: [] };
  }
}
