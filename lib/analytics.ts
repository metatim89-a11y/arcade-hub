import { getSupabase, isSupabaseConfigured } from './supabase';

export type SiteEventType = 'page_view' | 'game_opened' | 'game_completed' | 'session_start' | 'referral_visit' | 'share_clicked';
const VISITOR_KEY = 'arcade_visitor_id';

const visitorId = () => {
  const existing = window.localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(VISITOR_KEY, created);
  return created;
};

export const recordSiteEvent = async (eventType: SiteEventType, gameId?: string, userId?: string, source?: string) => {
  if (!isSupabaseConfigured) return;
  const { error } = await getSupabase().from('site_events').insert({
    visitor_id: visitorId(),
    user_id: userId || null,
    event_type: eventType,
    game_id: gameId || null,
    source: source || null,
  });
  if (error) console.warn('Analytics event was not recorded', error.message);
};
