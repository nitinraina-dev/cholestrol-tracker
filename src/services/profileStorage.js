import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILES_KEY = 'profiles_list';
const ACTIVE_KEY = 'active_profile_id';

export async function getProfiles() {
  const raw = await AsyncStorage.getItem(PROFILES_KEY);
  if (raw) return JSON.parse(raw);
  // Default profile created on first call
  const defaultProfile = { id: 'default', name: 'Me', createdAt: new Date().toISOString() };
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify([defaultProfile]));
  return [defaultProfile];
}

export async function getActiveProfileId() {
  return (await AsyncStorage.getItem(ACTIVE_KEY)) || 'default';
}

export async function setActiveProfile(id) {
  await AsyncStorage.setItem(ACTIVE_KEY, id);
}

export async function saveProfile(profile) {
  const list = await getProfiles();
  const idx = list.findIndex(p => p.id === profile.id);
  if (idx !== -1) {
    list[idx] = profile;
  } else {
    list.push({ ...profile, id: Date.now().toString(), createdAt: new Date().toISOString() });
  }
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(list));
  return list;
}

export async function deleteProfile(id) {
  const list = await getProfiles();
  if (list.length <= 1) return list; // Cannot delete last profile
  const filtered = list.filter(p => p.id !== id);
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(filtered));
  const activeId = await getActiveProfileId();
  if (activeId === id) await setActiveProfile(filtered[0].id);
  return filtered;
}

// Profile-scoped AsyncStorage key prefix
export function profileKey(baseKey, profileId) {
  if (!profileId || profileId === 'default') return baseKey;
  return `${baseKey}_profile_${profileId}`;
}
