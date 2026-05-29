import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'bp_readings';

export async function getBPReadings() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveBPReading(reading) {
  const list = await getBPReadings();
  list.unshift({
    id: Date.now().toString(),
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    pulse: reading.pulse ?? null,
    note: reading.note ?? '',
    timestamp: reading.timestamp ?? new Date().toISOString(),
  });
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function deleteBPReading(id) {
  const list = await getBPReadings();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter(r => r.id !== id)));
}

export function getBPCategory(systolic, diastolic) {
  if (systolic < 120 && diastolic < 80)  return { label: 'Normal',        color: '#00C48C' };
  if (systolic < 130 && diastolic < 80)  return { label: 'Elevated',       color: '#FF9F0A' };
  if (systolic < 140 || diastolic < 90)  return { label: 'High Stage 1',   color: '#FF8C00' };
  if (systolic < 180 || diastolic < 120) return { label: 'High Stage 2',   color: '#FF4757' };
  return { label: 'Crisis', color: '#CC0000' };
}
