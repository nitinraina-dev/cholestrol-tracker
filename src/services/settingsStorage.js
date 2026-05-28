import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  DIET: 'settings_diet_preference',
  WATER_GOAL: 'settings_water_goal',
  WATER_TODAY: 'water_today_',
};

export async function getDietPreference() {
  const val = await AsyncStorage.getItem(KEYS.DIET);
  return val || 'omnivore';
}

export async function setDietPreference(pref) {
  await AsyncStorage.setItem(KEYS.DIET, pref);
}

export async function getWaterGoal() {
  const val = await AsyncStorage.getItem(KEYS.WATER_GOAL);
  return val ? parseFloat(val) : 2.5;
}

export async function setWaterGoal(goal) {
  await AsyncStorage.setItem(KEYS.WATER_GOAL, goal.toString());
}

export async function getTodayWater() {
  const key = KEYS.WATER_TODAY + new Date().toDateString();
  const val = await AsyncStorage.getItem(key);
  return val ? parseFloat(val) : 0;
}

export async function addWater(amount) {
  const key = KEYS.WATER_TODAY + new Date().toDateString();
  const current = await getTodayWater();
  await AsyncStorage.setItem(key, (current + amount).toString());
  return current + amount;
}

export async function resetTodayWater() {
  const key = KEYS.WATER_TODAY + new Date().toDateString();
  await AsyncStorage.setItem(key, '0');
}

export const DIET_OPTIONS = [
  { key: 'veg',       label: 'Pure Vegetarian', icon: '🥦', desc: 'No meat, fish or eggs' },
  { key: 'nonveg',    label: 'Non-Vegetarian',  icon: '🍗', desc: 'Includes meat & fish' },
  { key: 'omnivore',  label: 'Omnivore',         icon: '🍱', desc: 'Everything in balance' },
];

const LANGUAGE_KEY = 'settings_language';

export async function getLanguagePreference() {
  const val = await AsyncStorage.getItem(LANGUAGE_KEY);
  return val || 'english';
}

export async function setLanguagePreference(lang) {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

export const LANGUAGE_OPTIONS = [
  { key: 'english',   label: 'English',    native: 'English' },
  { key: 'hinglish',  label: 'Hinglish',   native: 'Hinglish (Hindi + English)' },
  { key: 'hindi',     label: 'Hindi',      native: 'हिंदी' },
  { key: 'marathi',   label: 'Marathi',    native: 'मराठी' },
  { key: 'gujarati',  label: 'Gujarati',   native: 'ગુજરાતી' },
  { key: 'bengali',   label: 'Bengali',    native: 'বাংলা' },
  { key: 'tamil',     label: 'Tamil',      native: 'தமிழ்' },
  { key: 'telugu',    label: 'Telugu',     native: 'తెలుగు' },
  { key: 'kannada',   label: 'Kannada',    native: 'ಕನ್ನಡ' },
  { key: 'malayalam', label: 'Malayalam',  native: 'മലയാളം' },
  { key: 'punjabi',   label: 'Punjabi',    native: 'ਪੰਜਾਬੀ' },
];
