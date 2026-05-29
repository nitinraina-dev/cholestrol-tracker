import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBPReadings, saveBPReading, deleteBPReading, getBPCategory } from '../services/bpStorage';

function BPDot({ systolic, diastolic, size = 10 }) {
  const { color } = getBPCategory(systolic, diastolic);
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

function BPChart({ readings }) {
  if (readings.length < 2) return null;
  const last14 = [...readings].reverse().slice(-14);
  const maxSys = Math.max(...last14.map(r => r.systolic), 180);
  const minSys = Math.min(...last14.map(r => r.systolic), 90);
  const range = maxSys - minSys || 60;
  const H = 80;
  const W_STEP = 100 / (last14.length - 1);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Systolic Trend (last {last14.length} readings)</Text>
      <View style={{ height: H + 20, position: 'relative' }}>
        {[120, 140].map(line => {
          const pct = 1 - (line - minSys) / range;
          const top = Math.max(0, Math.min(pct * H, H - 1));
          const color = line === 120 ? '#00C48C' : '#FF4757';
          return (
            <View key={line} style={{ position: 'absolute', top, left: 0, right: 0, height: 1, backgroundColor: color + '40' }}>
              <Text style={{ fontSize: 9, color, position: 'absolute', right: 0, top: -10 }}>{line}</Text>
            </View>
          );
        })}
        {last14.map((r, i) => {
          const pct = 1 - (r.systolic - minSys) / range;
          const top = Math.max(0, Math.min(pct * H, H - 8));
          const left = `${i * W_STEP}%`;
          const { color } = getBPCategory(r.systolic, r.diastolic);
          return (
            <View key={r.id} style={{ position: 'absolute', top, left, alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function AddBPModal({ visible, onClose, onSave }) {
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [pulse, setPulse] = useState('');
  const [note, setNote] = useState('');

  const handleSave = async () => {
    const s = parseInt(sys, 10);
    const d = parseInt(dia, 10);
    if (isNaN(s) || s < 60 || s > 250) { Alert.alert('Enter valid systolic (60–250)'); return; }
    if (isNaN(d) || d < 40 || d > 150) { Alert.alert('Enter valid diastolic (40–150)'); return; }
    await onSave({ systolic: s, diastolic: d, pulse: pulse ? parseInt(pulse, 10) : null, note });
    setSys(''); setDia(''); setPulse(''); setNote('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Log Blood Pressure</Text>

          <View style={styles.bpRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bpFieldLabel}>Systolic (upper)</Text>
              <TextInput style={styles.bpInput} value={sys} onChangeText={setSys} keyboardType="number-pad" placeholder="120" placeholderTextColor="#C5C6D0" />
            </View>
            <Text style={styles.bpSlash}>/</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bpFieldLabel}>Diastolic (lower)</Text>
              <TextInput style={styles.bpInput} value={dia} onChangeText={setDia} keyboardType="number-pad" placeholder="80" placeholderTextColor="#C5C6D0" />
            </View>
          </View>

          <Text style={styles.bpFieldLabel}>Pulse (optional)</Text>
          <TextInput style={styles.bpInput} value={pulse} onChangeText={setPulse} keyboardType="number-pad" placeholder="72 bpm" placeholderTextColor="#C5C6D0" />

          <Text style={[styles.bpFieldLabel, { marginTop: 12 }]}>Note (optional)</Text>
          <TextInput style={[styles.bpInput, { height: 70, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} placeholder="e.g. After morning walk" placeholderTextColor="#C5C6D0" multiline />

          {sys && dia && !isNaN(parseInt(sys)) && !isNaN(parseInt(dia)) ? (
            <View style={[styles.categoryBanner, { backgroundColor: getBPCategory(parseInt(sys), parseInt(dia)).color + '18' }]}>
              <BPDot systolic={parseInt(sys)} diastolic={parseInt(dia)} size={10} />
              <Text style={[styles.categoryText, { color: getBPCategory(parseInt(sys), parseInt(dia)).color }]}>
                {getBPCategory(parseInt(sys), parseInt(dia)).label}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save Reading</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function BloodPressureScreen() {
  const insets = useSafeAreaInsets();
  const [readings, setReadings] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => setReadings(await getBPReadings()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Remove this reading?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteBPReading(id); load(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>

        <BPChart readings={readings} />

        {readings.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyAbbrev}>BP</Text>
            </View>
            <Text style={styles.emptyTitle}>No readings yet</Text>
            <Text style={styles.emptyHint}>Track your blood pressure over time. High BP combined with high cholesterol significantly raises CVD risk.</Text>
          </View>
        ) : (
          readings.map(r => {
            const cat = getBPCategory(r.systolic, r.diastolic);
            const d = new Date(r.timestamp);
            const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            const timeLabel = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.bpIconBox, { backgroundColor: cat.color + '18' }]}>
                    <Text style={[styles.bpIconText, { color: cat.color }]}>BP</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bpValue}>{r.systolic}/{r.diastolic} <Text style={styles.bpUnit}>mmHg</Text></Text>
                    <Text style={styles.bpDate}>{dateLabel} · {timeLabel}{r.pulse ? ` · ${r.pulse} bpm` : ''}</Text>
                  </View>
                  <View style={[styles.catChip, { backgroundColor: cat.color + '18' }]}>
                    <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(r.id)} style={styles.delBtn}>
                    <Text style={styles.delBtnText}>Del</Text>
                  </TouchableOpacity>
                </View>
                {r.note ? <Text style={styles.noteText}>{r.note}</Text> : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => setShowModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>Log Blood Pressure</Text>
      </TouchableOpacity>

      <AddBPModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={async (data) => { await saveBPReading(data); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  scroll: { padding: 16 },

  chartCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  chartTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 10 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyAbbrev: { fontSize: 22, fontWeight: '900', color: '#6C63FF', letterSpacing: 1 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 10 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bpIconBox: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bpIconText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  bpValue: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  bpUnit: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  bpDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  catChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  catText: { fontSize: 11, fontWeight: '700' },
  delBtn: { backgroundColor: '#FFF0F1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginLeft: 4 },
  delBtnText: { fontSize: 12, fontWeight: '700', color: '#FF4757' },
  noteText: { fontSize: 13, color: '#636366', marginTop: 8, lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: '#00000040' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 20 },
  bpRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 12 },
  bpSlash: { fontSize: 32, fontWeight: '300', color: '#C5C6D0', marginBottom: 8 },
  bpFieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  bpInput: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 18, fontWeight: '800', color: '#1A1A2E', borderWidth: 1.5, borderColor: '#E5E5EA', textAlign: 'center' },
  categoryBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, marginTop: 12 },
  categoryText: { fontSize: 14, fontWeight: '700' },
  saveBtn: { backgroundColor: '#6C63FF', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  fab: { position: 'absolute', left: 20, right: 20, backgroundColor: '#6C63FF', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#6C63FF', shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
