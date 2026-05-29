import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'medications_list';

export async function getMedications() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveMedication(med) {
  const list = await getMedications();
  list.unshift({ ...med, id: Date.now().toString() });
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function updateMedication(id, updates) {
  const list = await getMedications();
  const idx = list.findIndex(m => m.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  }
}

export async function deleteMedication(id) {
  const list = await getMedications();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter(m => m.id !== id)));
}

// Log a dose taken for today
export async function logDose(medicationId, date) {
  const key = `med_dose_${medicationId}_${date}`;
  await AsyncStorage.setItem(key, 'taken');
}

export async function isDoseTaken(medicationId, date) {
  const key = `med_dose_${medicationId}_${date}`;
  return (await AsyncStorage.getItem(key)) === 'taken';
}

export async function unlogDose(medicationId, date) {
  const key = `med_dose_${medicationId}_${date}`;
  await AsyncStorage.removeItem(key);
}

// Returns adherence % for last 30 days
export async function getAdherenceRate(medicationId, startDate) {
  const start = new Date(startDate);
  const today = new Date();
  const days = Math.ceil((today - start) / 86400000) + 1;
  const total = Math.min(days, 30);
  let taken = 0;
  for (let i = 0; i < total; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toDateString();
    const k = `med_dose_${medicationId}_${dateStr}`;
    const v = await AsyncStorage.getItem(k);
    if (v === 'taken') taken++;
  }
  return total > 0 ? Math.round((taken / total) * 100) : 0;
}
