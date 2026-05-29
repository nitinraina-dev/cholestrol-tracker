import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'exercise_log';

export const EXERCISE_TYPES = [
  { key: 'walk',    label: 'Walk',    abbrev: 'WK' },
  { key: 'run',     label: 'Run',     abbrev: 'RN' },
  { key: 'cycle',   label: 'Cycle',   abbrev: 'CY' },
  { key: 'swim',    label: 'Swim',    abbrev: 'SW' },
  { key: 'yoga',    label: 'Yoga',    abbrev: 'YG' },
  { key: 'gym',     label: 'Gym',     abbrev: 'GM' },
  { key: 'other',   label: 'Other',   abbrev: 'OT' },
];

export async function getExerciseLogs() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveExerciseLog(entry) {
  const list = await getExerciseLogs();
  list.unshift({
    id: Date.now().toString(),
    type: entry.type,
    durationMin: entry.durationMin,
    note: entry.note ?? '',
    timestamp: entry.timestamp ?? new Date().toISOString(),
  });
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function deleteExerciseLog(id) {
  const list = await getExerciseLogs();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter(e => e.id !== id)));
}

export function getExerciseWeeklyMinutes(logs) {
  const map = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    map[d.toDateString()] = 0;
  }
  logs.forEach(l => {
    const d = new Date(l.timestamp).toDateString();
    if (d in map) map[d] += l.durationMin || 0;
  });
  return map;
}
