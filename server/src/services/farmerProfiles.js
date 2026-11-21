import { HttpError } from '../utils/http.js';
import { supabaseSetupError } from '../config/supabase.js';

export function mapFarmer(row) {
  return {
    _id: row.id,
    name: row.name,
    email: row.email,
    state: row.state || '',
    district: row.district || '',
    village: row.village || '',
    preferredLanguage: row.preferred_language || 'en',
    farmSize: row.farm_size == null ? undefined : Number(row.farm_size),
    soil: row.soil || {},
    irrigationFacilities: row.irrigation_facilities || [],
    currentCrops: row.current_crops || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getOrCreateFarmer(supabase, user) {
  const { data, error } = await supabase.from('farmers').select('*').eq('id', user.id).maybeSingle();
  if (error) throw supabaseSetupError(error);
  if (data) return mapFarmer(data);

  const metadata = user.user_metadata || {};
  const name = cleanProfileText(metadata.name || user.email?.split('@')[0], 100);
  const preferredLanguage = ['en', 'hi', 'kn'].includes(metadata.preferredLanguage) ? metadata.preferredLanguage : 'en';
  const { data: inserted, error: insertError } = await supabase.from('farmers')
    .insert({
      id: user.id,
      name,
      email: user.email || '',
      state: cleanProfileText(metadata.state, 100),
      district: cleanProfileText(metadata.district, 100),
      village: cleanProfileText(metadata.village, 100),
      preferred_language: preferredLanguage,
      current_crops: cleanProfileList(metadata.currentCrops)
    })
    .select('*')
    .single();
  if (!insertError) return mapFarmer(inserted);
  if (insertError.code === '23505') {
    const { data: existing, error: selectError } = await supabase.from('farmers').select('*').eq('id', user.id).single();
    if (!selectError && existing) return mapFarmer(existing);
  }
  throw supabaseSetupError(insertError);
}

function cleanProfileText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanProfileList(value) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return items.filter(item => typeof item === 'string').map(item => item.trim().slice(0, 100)).filter(Boolean).slice(0, 20);
}

export function profileUpdates(body = {}) {
  const update = {};
  if (Object.hasOwn(body, 'name')) update.name = String(body.name).trim();
  if (Object.hasOwn(body, 'state')) update.state = String(body.state || '').trim();
  if (Object.hasOwn(body, 'district')) update.district = String(body.district || '').trim();
  if (Object.hasOwn(body, 'village')) update.village = String(body.village || '').trim();
  if (Object.hasOwn(body, 'preferredLanguage')) update.preferred_language = body.preferredLanguage;
  if (Object.hasOwn(body, 'farmSize')) update.farm_size = body.farmSize === '' ? null : body.farmSize;
  if (Object.hasOwn(body, 'soil')) update.soil = body.soil;
  if (Object.hasOwn(body, 'irrigationFacilities')) update.irrigation_facilities = body.irrigationFacilities;
  if (Object.hasOwn(body, 'currentCrops')) update.current_crops = body.currentCrops;
  update.updated_at = new Date().toISOString();
  return update;
}

export async function updateFarmerProfile(supabase, userId, updates) {
  const { data, error } = await supabase.from('farmers').update(updates).eq('id', userId).select('*').single();
  if (error) throw supabaseSetupError(error);
  if (!data) throw new HttpError(404, 'Farmer profile not found.');
  return mapFarmer(data);
}
