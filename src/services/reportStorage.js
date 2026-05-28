import AsyncStorage from '@react-native-async-storage/async-storage';

const REPORTS_KEY = 'cholesterol_reports';

export async function saveReport(report) {
  const existing = await getReports();
  const updated = [report, ...existing];
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
}

export async function getReports() {
  const raw = await AsyncStorage.getItem(REPORTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getLatestReport() {
  const reports = await getReports();
  return reports.length ? reports[0] : null;
}

export async function deleteReport(id) {
  const reports = await getReports();
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports.filter(r => r.id !== id)));
}

export async function updateReport(id, updates) {
  const reports = await getReports();
  const updated = reports.map(r => r.id === id ? { ...r, ...updates } : r);
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
}

// Parses report dates in any format the AI might return (DD/MM/YYYY, DD-MM-YYYY, ISO, English, etc.)
export function parseReportDate(dateStr) {
  if (!dateStr) return null;
  // DD/MM/YYYY or DD-MM-YYYY (common in Indian lab reports)
  const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  // ISO YYYY-MM-DD — append time to avoid UTC midnight shifting day
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${dateStr}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  // Native fallback ("March 15, 2024", "15 March 2024", etc.)
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function getValueStatus(key, value) {
  const ranges = {
    totalCholesterol: { low: 0, normal: 200, borderline: 239, high: Infinity },
    ldl:              { low: 0, normal: 100, borderline: 129, high: Infinity },
    hdl:              null, // higher is better
    vldl:             { low: 0, normal: 30,  borderline: 40,  high: Infinity },
    triglycerides:    { low: 0, normal: 150, borderline: 199, high: Infinity },
  };

  if (key === 'hdl') {
    if (value >= 60) return { label: 'Optimal', color: '#34C759' };
    if (value >= 40) return { label: 'Normal', color: '#FF9500' };
    return { label: 'Low', color: '#FF3B30' };
  }

  const r = ranges[key];
  if (!r) return { label: 'Unknown', color: '#8E8E93' };
  if (value <= r.normal) return { label: 'Normal', color: '#34C759' };
  if (value <= r.borderline) return { label: 'Borderline', color: '#FF9500' };
  return { label: 'High', color: '#FF3B30' };
}
