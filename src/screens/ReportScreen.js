import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLayoutEffect } from 'react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getReports, deleteReport, getValueStatus, parseReportDate } from '../services/reportStorage';

const FIELDS = [
  { key: 'totalCholesterol', label: 'Total Cholesterol', unit: 'mg/dL' },
  { key: 'ldl',              label: 'LDL (Bad)',          unit: 'mg/dL' },
  { key: 'hdl',              label: 'HDL (Good)',         unit: 'mg/dL' },
  { key: 'vldl',             label: 'VLDL',               unit: 'mg/dL' },
  { key: 'triglycerides',    label: 'Triglycerides',      unit: 'mg/dL' },
];

const STATUS_COLORS = {
  Normal: '#00C48C', High: '#FF4757', Low: '#FF8C00',
  'Very High': '#FF4757', Borderline: '#FF8C00',
};

function ValueChip({ label, color }) {
  return (
    <View style={[styles.chip, { backgroundColor: (color || '#9CA3AF') + '22' }]}>
      <Text style={[styles.chipText, { color: color || '#9CA3AF' }]}>{label}</Text>
    </View>
  );
}

function FieldLabel({ field }) {
  const abbrevs = { totalCholesterol: 'TC', ldl: 'LDL', hdl: 'HDL', vldl: 'VLDL', triglycerides: 'TG' };
  const colors   = { totalCholesterol: '#6C63FF', ldl: '#FF4757', hdl: '#00C48C', vldl: '#FF8C00', triglycerides: '#3B82F6' };
  return (
    <View style={[styles.fieldLabelBox, { backgroundColor: (colors[field] || '#9CA3AF') + '18' }]}>
      <Text style={[styles.fieldLabelAbbrev, { color: colors[field] || '#9CA3AF' }]}>
        {abbrevs[field] || field.toUpperCase()}
      </Text>
    </View>
  );
}

function ReportCard({ report, onDelete, onEdit }) {
  const parsedDate = parseReportDate(report.date);
  const dateLabel = parsedDate
    ? parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : report.date || 'Unknown date';
  const filledCount = FIELDS.filter(f => report[f.key] != null).length;

  return (
    <View style={styles.reportCard}>
      <View style={styles.reportCardTop}>
        <View style={styles.reportIconBox}>
          <Text style={styles.reportIconText}>DNA</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reportDate}>{dateLabel}</Text>
          <Text style={styles.reportSub}>{filledCount} values recorded</Text>
        </View>
        <View style={styles.reportCardActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(report)}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(report.id)}>
            <Text style={styles.deleteBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.reportDivider} />

      {FIELDS.map(({ key, label, unit }) => {
        const val = report[key];
        if (val == null) return null;
        const status = getValueStatus(key, val);
        const color = STATUS_COLORS[status.label] || '#9CA3AF';
        return (
          <View key={key} style={styles.reportRow}>
            <FieldLabel field={key} />
            <Text style={styles.reportLabel}>{label}</Text>
            <View style={styles.reportRowRight}>
              <Text style={[styles.reportValue, { color }]}>{val}</Text>
              <Text style={styles.reportUnit}>{unit}</Text>
              <ValueChip label={status.label} color={color} />
            </View>
          </View>
        );
      })}

      {report.imageUri && (
        <Image source={{ uri: report.imageUri }} style={styles.reportThumb} resizeMode="cover" />
      )}
    </View>
  );
}

function buildReportHTML(reports) {
  const rows = reports.map(r => {
    const d = parseReportDate(r.date);
    const dateLabel = d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : (r.date || 'Unknown');
    const fields = [
      { label: 'Total Cholesterol', key: 'totalCholesterol', unit: 'mg/dL' },
      { label: 'LDL', key: 'ldl', unit: 'mg/dL' },
      { label: 'HDL', key: 'hdl', unit: 'mg/dL' },
      { label: 'VLDL', key: 'vldl', unit: 'mg/dL' },
      { label: 'Triglycerides', key: 'triglycerides', unit: 'mg/dL' },
    ].filter(f => r[f.key] != null);
    const fieldRows = fields.map(f => `<tr><td>${f.label}</td><td><b>${r[f.key]} ${f.unit}</b></td></tr>`).join('');
    return `<div class="report"><h3>${dateLabel}</h3><table>${fieldRows}</table></div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: Helvetica, sans-serif; padding: 24px; color: #1A1A2E; }
    h1 { color: #6C63FF; font-size: 22px; }
    h3 { font-size: 16px; color: #333; margin-bottom: 8px; }
    .report { border: 1px solid #E5E5EA; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 6px 0; border-bottom: 1px solid #F2F2F7; font-size: 14px; }
    td:last-child { text-align: right; }
    .footer { font-size: 11px; color: #9CA3AF; margin-top: 24px; }
  </style></head><body>
    <h1>Cholesterol Report Summary</h1>
    <p style="color:#9CA3AF;font-size:13px;">Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · ${reports.length} report${reports.length !== 1 ? 's' : ''}</p>
    ${rows}
    <p class="footer">Generated by Cholesterol Tracker. For medical decisions always consult your doctor.</p>
  </body></html>`;
}

export default function ReportScreen({ navigation }) {
  const [reports, setReports] = useState([]);

  const load = useCallback(async () => { setReports(await getReports()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => reports.length > 0 ? (
        <TouchableOpacity onPress={handleExport} style={{ marginRight: 4 }}>
          <Text style={{ color: '#6C63FF', fontWeight: '800', fontSize: 15 }}>Share</Text>
        </TouchableOpacity>
      ) : null,
    });
  }, [reports]);

  const handleExport = async () => {
    try {
      const html = buildReportHTML(reports);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Cholesterol Report' });
      } else {
        Alert.alert('Sharing not available on this device');
      }
    } catch {
      Alert.alert('Could not export report. Please try again.');
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Report', 'Remove this report?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteReport(id); load(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {reports.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyAbbrev}>DNA</Text>
            </View>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyHint}>
              Upload your blood test report to get personalised advice when scanning food
            </Text>
          </View>
        ) : (
          reports.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              onDelete={handleDelete}
              onEdit={report => navigation.navigate('AddReport', { report })}
            />
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddReport')} activeOpacity={0.85}>
        <Text style={styles.fabText}>Add Blood Report</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  scroll: { padding: 16, paddingBottom: 110 },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyAbbrev: { fontSize: 18, fontWeight: '900', color: '#6C63FF', letterSpacing: 1 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 10 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  reportCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  reportCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  reportIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  reportIconText: { fontSize: 10, fontWeight: '900', color: '#6C63FF', letterSpacing: 0.5 },
  reportDate: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  reportSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  reportCardActions: { flexDirection: 'row', gap: 6 },
  editBtn: { backgroundColor: '#EEF0FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#6C63FF' },
  deleteBtn: { backgroundColor: '#FFF0F1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#FF4757' },
  reportDivider: { height: 1, backgroundColor: '#F2F2F7', marginBottom: 12 },
  reportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  fieldLabelBox: { width: 42, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fieldLabelAbbrev: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  reportLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#2D3748' },
  reportRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reportValue: { fontSize: 15, fontWeight: '800' },
  reportUnit: { fontSize: 11, color: '#9CA3AF' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { fontSize: 11, fontWeight: '700' },
  reportThumb: { width: '100%', height: 130, borderRadius: 14, marginTop: 14 },

  fab: { position: 'absolute', bottom: 24, left: 20, right: 20, backgroundColor: '#6C63FF', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#6C63FF', shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
