import React, { useState, useCallback, useLayoutEffect, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { extractReportValues, RateLimitError } from '../services/gemini';
import { saveReport, getReports, updateReport, parseReportDate } from '../services/reportStorage';
import { getMeals } from '../services/storage';
import { refreshBadges } from '../services/streakStorage';

const FIELDS = [
  { key: 'totalCholesterol', label: 'Total Cholesterol', unit: 'mg/dL' },
  { key: 'ldl',              label: 'LDL (Bad)',          unit: 'mg/dL' },
  { key: 'hdl',              label: 'HDL (Good)',         unit: 'mg/dL' },
  { key: 'vldl',             label: 'VLDL',               unit: 'mg/dL' },
  { key: 'triglycerides',    label: 'Triglycerides',      unit: 'mg/dL' },
];

export default function AddReportScreen({ navigation, route }) {
  const existing = route.params?.report;

  const [mode, setMode] = useState(existing ? 'manual' : 'choose');
  const [countdown, setCountdown] = useState(null);
  const retryRef = useRef(null);
  const retryCountRef = useRef(0);
  const [form, setForm] = useState({
    totalCholesterol: existing?.totalCholesterol?.toString() ?? '',
    ldl:              existing?.ldl?.toString()              ?? '',
    hdl:              existing?.hdl?.toString()              ?? '',
    vldl:             existing?.vldl?.toString()             ?? '',
    triglycerides:    existing?.triglycerides?.toString()    ?? '',
    date:             existing?.date || '',
  });
  const [extractedImage, setExtractedImage] = useState(existing?.imageUri || null);

  const save = useCallback(async () => {
    if (!FIELDS.some(f => form[f.key] !== '')) {
      Alert.alert('Missing values', 'Enter at least one cholesterol value.');
      return;
    }
    const data = { date: form.date || new Date().toISOString().split('T')[0], imageUri: extractedImage };
    FIELDS.forEach(({ key }) => {
      const v = parseFloat(form[key]);
      data[key] = isNaN(v) ? null : v;
    });
    if (existing) {
      await updateReport(existing.id, data);
    } else {
      await saveReport({ id: Date.now().toString(), ...data });
    }
    const [allMeals, allReports] = await Promise.all([getMeals(), getReports()]);
    await refreshBadges(allMeals, allReports);
    navigation.goBack();
  }, [form, extractedImage, existing, navigation]);

  // Put Save button in header when on the form view
  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Edit Report' : 'Add Report',
      headerRight: mode === 'manual' ? () => (
        <TouchableOpacity onPress={save} hitSlop={{ top: 12, bottom: 12, left: 16, right: 4 }}>
          <Text style={s.headerSave}>Save</Text>
        </TouchableOpacity>
      ) : undefined,
    });
  }, [navigation, mode, save, existing]);

  // Countdown effect — ticks every second, auto-retries when it reaches 0
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { retryRef.current?.(); return; }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const runExtraction = async (uri, mimeType) => {
    setExtractedImage(uri);
    setMode('uploading');
    setCountdown(null);
    try {
      const extracted = await extractReportValues(uri, mimeType);
      setForm({
        totalCholesterol: extracted.totalCholesterol?.toString() ?? '',
        ldl:              extracted.ldl?.toString()              ?? '',
        hdl:              extracted.hdl?.toString()              ?? '',
        vldl:             extracted.vldl?.toString()             ?? '',
        triglycerides:    extracted.triglycerides?.toString()    ?? '',
        date:             (() => {
          const p = parseReportDate(extracted.reportDate);
          return p ? p.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        })(),
      });
      retryCountRef.current = 0;
      setMode('manual');
    } catch (e) {
      if (e instanceof RateLimitError && retryCountRef.current < 2 && (e.waitMs || 0) <= 120000) {
        retryCountRef.current++;
        retryRef.current = () => runExtraction(uri, mimeType);
        setCountdown(Math.ceil((e.waitMs || 60000) / 1000));
      } else {
        retryCountRef.current = 0;
        Alert.alert('Could not read report', 'You can enter the values manually instead.');
        setMode('manual');
      }
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Allow photo library access in Settings.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) await runExtraction(res.assets[0].uri, res.assets[0].mimeType || 'image/jpeg');
  };

  const pickPDF = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.[0]) await runExtraction(res.assets[0].uri, 'application/pdf');
  };

  // ── Choose mode ─────────────────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.chooseContent}>
        <Text style={s.subtitle}>How would you like to add your report?</Text>

        <TouchableOpacity style={s.optPrimary} onPress={pickImage} activeOpacity={0.85}>
          <View style={s.optIconBoxPrimary}>
            <View style={{ width: 22, height: 18, borderRadius: 3, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 8, height: 6, borderRadius: 1.5, backgroundColor: '#fff', opacity: 0.7 }} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.optTitleWhite}>Upload Lab Photo</Text>
            <Text style={s.optDescWhite}>Pick an image from your gallery</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.optSecondary} onPress={pickPDF} activeOpacity={0.85}>
          <View style={s.optIconBox}>
            <Text style={s.optIconText}>PDF</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.optTitle}>Upload PDF Report</Text>
            <Text style={s.optDesc}>Pick a PDF from your files</Text>
          </View>
          <Text style={{ color: '#9CA3AF', fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.optSecondary} onPress={() => setMode('manual')} activeOpacity={0.85}>
          <View style={s.optIconBox}>
            <Text style={s.optIconText}>123</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.optTitle}>Enter Manually</Text>
            <Text style={s.optDesc}>Type in your blood test values</Text>
          </View>
          <Text style={{ color: '#9CA3AF', fontSize: 20 }}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Uploading mode ───────────────────────────────────────────────────────────
  if (mode === 'uploading') {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={s.loadingTitle}>Reading your report</Text>
        <Text style={s.loadingHint}>
          {countdown !== null
            ? `Ready in ${countdown}s`
            : 'AI is extracting cholesterol values'}
        </Text>
      </View>
    );
  }

  // ── Manual entry mode ────────────────────────────────────────────────────────
  return (
    <ScrollView style={s.container} contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
      {extractedImage && (
        <Image source={{ uri: extractedImage }} style={s.previewImage} resizeMode="cover" />
      )}

      <View style={s.hintBox}>
        <View style={s.hintDot} />
        <Text style={s.hintText}>
          {extractedImage ? 'Review and correct the extracted values' : 'Enter values from your blood test report'}
        </Text>
      </View>

      <Text style={s.label}>Report Date</Text>
      <TextInput
        style={s.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#C5C6D0"
        value={form.date}
        onChangeText={v => setForm(p => ({ ...p, date: v }))}
      />

      {FIELDS.map(({ key, label, unit }) => (
        <View key={key}>
          <View style={s.labelRow}>
            <Text style={s.label}>{label}</Text>
            <Text style={s.unit}>{unit}</Text>
          </View>
          <TextInput
            style={s.input}
            placeholder="e.g. 120"
            placeholderTextColor="#C5C6D0"
            keyboardType="numeric"
            value={form[key]}
            onChangeText={v => setForm(p => ({ ...p, [key]: v }))}
          />
        </View>
      ))}

      <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.85}>
        <Text style={s.saveBtnText}>{existing ? 'Update Report' : 'Save Report'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  chooseContent: { padding: 20, paddingBottom: 40 },
  formContent: { padding: 20, paddingBottom: 48 },

  subtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 20, textAlign: 'center' },

  optPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#6C63FF',
    padding: 18, borderRadius: 18, marginBottom: 10,
    shadowColor: '#6C63FF', shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  optSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff',
    padding: 18, borderRadius: 18, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  optIconBoxPrimary: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' },
  optIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#6C63FF12', alignItems: 'center', justifyContent: 'center' },
  optIconText: { fontSize: 11, fontWeight: '900', color: '#6C63FF', letterSpacing: 0.3 },
  optTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  optTitleWhite: { fontSize: 15, fontWeight: '700', color: '#fff' },
  optDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  optDescWhite: { fontSize: 13, color: '#ffffffBB', marginTop: 2 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#F2F2F7' },
  loadingTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  loadingHint: { fontSize: 13, color: '#9CA3AF' },

  previewImage: { width: '100%', height: 180, borderRadius: 16, marginBottom: 16 },
  hintBox: { backgroundColor: '#E6FBF5', borderRadius: 12, padding: 12, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00C48C' },
  hintText: { fontSize: 13, color: '#00875A', fontWeight: '600', flex: 1 },

  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginTop: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginBottom: 6, marginTop: 14 },
  unit: { fontSize: 12, color: '#9CA3AF', marginTop: 14 },
  input: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    fontSize: 15, color: '#1A1A2E', borderWidth: 1.5, borderColor: '#E5E5EA',
  },

  saveBtn: {
    backgroundColor: '#6C63FF', padding: 18, borderRadius: 16,
    alignItems: 'center', marginTop: 28,
    shadowColor: '#6C63FF', shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  headerSave: { color: '#6C63FF', fontSize: 16, fontWeight: '800' },
});
