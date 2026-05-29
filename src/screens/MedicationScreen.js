import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMedications, deleteMedication, logDose, unlogDose, isDoseTaken, getAdherenceRate } from '../services/medicationStorage';

const FREQ_LABELS = { daily: 'Daily', twice: 'Twice daily', weekly: 'Weekly', asneeded: 'As needed' };

function AdherenceBar({ pct }) {
  const color = pct >= 80 ? '#00C48C' : pct >= 50 ? '#FF9F0A' : '#FF4757';
  return (
    <View style={styles.adherenceRow}>
      <View style={styles.adherenceBg}>
        <View style={[styles.adherenceFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.adherencePct, { color }]}>{pct}%</Text>
    </View>
  );
}

function MedCard({ med, onDelete, onEdit, onRefresh }) {
  const [taken, setTaken] = useState(false);
  const [adherence, setAdherence] = useState(0);
  const today = new Date().toDateString();

  useFocusEffect(useCallback(() => {
    isDoseTaken(med.id, today).then(setTaken);
    getAdherenceRate(med.id, med.startDate || med.id).then(setAdherence);
  }, [med.id, today]));

  const toggleDose = async () => {
    if (taken) {
      await unlogDose(med.id, today);
      setTaken(false);
    } else {
      await logDose(med.id, today);
      setTaken(true);
    }
    onRefresh?.();
  };

  const handleDelete = () => {
    Alert.alert('Delete Medication', `Remove "${med.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteMedication(med.id); onRefresh?.(); } },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconBox, { backgroundColor: taken ? '#00C48C18' : '#6C63FF18' }]}>
          <Text style={[styles.iconAbbrev, { color: taken ? '#00C48C' : '#6C63FF' }]}>Rx</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.medName}>{med.name}</Text>
          <Text style={styles.medSub}>{med.dose}{med.dose ? ' · ' : ''}{FREQ_LABELS[med.frequency] || med.frequency}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(med)}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Del</Text>
          </TouchableOpacity>
        </View>
      </View>

      {med.note ? <Text style={styles.medNote}>{med.note}</Text> : null}

      <View style={styles.cardDivider} />

      <View style={styles.cardBottom}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adherenceLabel}>30-day adherence</Text>
          <AdherenceBar pct={adherence} />
        </View>
        <TouchableOpacity
          style={[styles.doseBtn, taken && styles.doseBtnTaken]}
          onPress={toggleDose}
          activeOpacity={0.8}
        >
          <Text style={[styles.doseBtnText, taken && styles.doseBtnTextTaken]}>
            {taken ? 'Taken Today' : 'Mark Taken'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MedicationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [meds, setMeds] = useState([]);

  const load = useCallback(async () => setMeds(await getMedications()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
        {meds.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyAbbrev}>Rx</Text>
            </View>
            <Text style={styles.emptyTitle}>No medications added</Text>
            <Text style={styles.emptyHint}>Add your cholesterol medications to track daily adherence and correlate with your blood reports.</Text>
          </View>
        ) : (
          meds.map(m => (
            <MedCard
              key={m.id}
              med={m}
              onDelete={() => load()}
              onEdit={med => navigation.navigate('AddMedication', { med })}
              onRefresh={load}
            />
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => navigation.navigate('AddMedication')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>Add Medication</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  scroll: { padding: 16 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyAbbrev: { fontSize: 22, fontWeight: '900', color: '#6C63FF', letterSpacing: 1 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 10 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  iconBox: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  iconAbbrev: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  medName: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  medSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 6 },
  editBtn: { backgroundColor: '#EEF0FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#6C63FF' },
  deleteBtn: { backgroundColor: '#FFF0F1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#FF4757' },
  medNote: { fontSize: 13, color: '#636366', marginBottom: 8, lineHeight: 18 },
  cardDivider: { height: 1, backgroundColor: '#F2F2F7', marginVertical: 10 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 14 },

  adherenceLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 5 },
  adherenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adherenceBg: { flex: 1, height: 6, backgroundColor: '#F2F2F7', borderRadius: 3, overflow: 'hidden' },
  adherenceFill: { height: '100%', borderRadius: 3 },
  adherencePct: { fontSize: 12, fontWeight: '800', minWidth: 32, textAlign: 'right' },

  doseBtn: { backgroundColor: '#EEF0FF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#6C63FF33' },
  doseBtnTaken: { backgroundColor: '#00C48C18', borderColor: '#00C48C33' },
  doseBtnText: { fontSize: 13, fontWeight: '700', color: '#6C63FF' },
  doseBtnTextTaken: { color: '#00C48C' },

  fab: { position: 'absolute', left: 20, right: 20, backgroundColor: '#6C63FF', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#6C63FF', shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
