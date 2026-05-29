import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getExerciseLogs, saveExerciseLog, deleteExerciseLog,
  EXERCISE_TYPES, getExerciseWeeklyMinutes,
} from '../services/exerciseStorage';

const TYPE_COLORS = { walk: '#00C48C', run: '#FF4757', cycle: '#FF9F0A', swim: '#3B82F6', yoga: '#8B5CF6', gym: '#6C63FF', other: '#9CA3AF' };
const GOAL_MIN = 150; // WHO recommendation: 150 min/week cardio

function WeeklyChart({ logs }) {
  const map = getExerciseWeeklyMinutes(logs);
  const days = Object.entries(map);
  const maxMin = Math.max(...Object.values(map), GOAL_MIN / 7);
  const totalWeek = Object.values(map).reduce((a, b) => a + b, 0);
  const today = new Date().toDateString();

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>This Week</Text>
          <Text style={styles.chartSub}>{totalWeek} min · goal {GOAL_MIN} min/week</Text>
        </View>
        <View style={[styles.goalChip, { backgroundColor: totalWeek >= GOAL_MIN ? '#00C48C18' : '#FF9F0A18' }]}>
          <Text style={[styles.goalChipText, { color: totalWeek >= GOAL_MIN ? '#00C48C' : '#FF9F0A' }]}>
            {Math.round((totalWeek / GOAL_MIN) * 100)}%
          </Text>
        </View>
      </View>
      <View style={styles.barsRow}>
        {days.map(([dateStr, mins]) => {
          const pct = Math.min((mins / maxMin) * 100, 100);
          const isToday = dateStr === today;
          const d = new Date(dateStr);
          const label = d.toLocaleDateString('en', { weekday: 'narrow' });
          return (
            <View key={dateStr} style={styles.barCol}>
              <Text style={styles.barVal}>{mins > 0 ? mins : ''}</Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { height: `${pct}%`, backgroundColor: isToday ? '#6C63FF' : '#00C48C' }]} />
              </View>
              <Text style={[styles.barLabel, isToday && { color: '#6C63FF', fontWeight: '800' }]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function LogModal({ visible, onClose, onSave }) {
  const [type, setType] = useState('walk');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');

  const handleSave = async () => {
    const mins = parseInt(duration, 10);
    if (isNaN(mins) || mins < 1 || mins > 600) { Alert.alert('Enter duration in minutes (1–600)'); return; }
    await onSave({ type, durationMin: mins, note });
    setType('walk'); setDuration(''); setNote('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Log Exercise</Text>

          <Text style={styles.fieldLabel}>Activity Type</Text>
          <View style={styles.typeGrid}>
            {EXERCISE_TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeChip, type === t.key && { backgroundColor: (TYPE_COLORS[t.key] || '#9CA3AF') + '20', borderColor: TYPE_COLORS[t.key] || '#9CA3AF' }]}
                onPress={() => setType(t.key)}
                activeOpacity={0.8}
              >
                <View style={[styles.typeAbbrevBox, { backgroundColor: (TYPE_COLORS[t.key] || '#9CA3AF') + '20' }]}>
                  <Text style={[styles.typeAbbrev, { color: TYPE_COLORS[t.key] || '#9CA3AF' }]}>{t.abbrev}</Text>
                </View>
                <Text style={[styles.typeLabel, type === t.key && { color: TYPE_COLORS[t.key] || '#9CA3AF' }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Duration (minutes)</Text>
          <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="30" placeholderTextColor="#C5C6D0" />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Note (optional)</Text>
          <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} placeholder="e.g. Morning jog, felt great" placeholderTextColor="#C5C6D0" multiline />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ExerciseScreen() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => setLogs(await getExerciseLogs()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExerciseLog(id); load(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
        <WeeklyChart logs={logs} />

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Why exercise lowers cholesterol</Text>
          <Text style={styles.tipText}>· 30 min brisk walk daily raises HDL by up to 10%</Text>
          <Text style={styles.tipText}>· Cardio 150 min/week cuts triglycerides by 20%</Text>
          <Text style={styles.tipText}>· Consistent exercise reduces LDL oxidation risk</Text>
        </View>

        {logs.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyAbbrev}>EX</Text>
            </View>
            <Text style={styles.emptyTitle}>No exercise logged</Text>
            <Text style={styles.emptyHint}>Log your workouts to see the impact on your cholesterol over time.</Text>
          </View>
        ) : (
          logs.map(entry => {
            const typeInfo = EXERCISE_TYPES.find(t => t.key === entry.type) || EXERCISE_TYPES[0];
            const color = TYPE_COLORS[entry.type] || '#9CA3AF';
            const d = new Date(entry.timestamp);
            const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            return (
              <View key={entry.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={[styles.typeIconBox, { backgroundColor: color + '18' }]}>
                    <Text style={[styles.typeIconAbbrev, { color }]}>{typeInfo.abbrev}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryTitle}>{typeInfo.label}</Text>
                    <Text style={styles.entryDate}>{label}</Text>
                    {entry.note ? <Text style={styles.entryNote}>{entry.note}</Text> : null}
                  </View>
                  <View style={[styles.durationBadge, { backgroundColor: color + '18' }]}>
                    <Text style={[styles.durationText, { color }]}>{entry.durationMin}m</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(entry.id)} style={styles.delBtn}>
                    <Text style={styles.delBtnText}>Del</Text>
                  </TouchableOpacity>
                </View>
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
        <Text style={styles.fabText}>Log Exercise</Text>
      </TouchableOpacity>

      <LogModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={async (data) => { await saveExerciseLog(data); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  scroll: { padding: 16 },

  chartCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  chartTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  chartSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  goalChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  goalChipText: { fontSize: 13, fontWeight: '800' },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 80 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barBg: { width: 22, flex: 1, backgroundColor: '#F2F2F7', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  barVal: { fontSize: 9, color: '#6B7280', fontWeight: '700' },

  tipsCard: { backgroundColor: '#EEF0FF', borderRadius: 18, padding: 16, marginBottom: 14 },
  tipsTitle: { fontSize: 13, fontWeight: '800', color: '#6C63FF', marginBottom: 8 },
  tipText: { fontSize: 12, color: '#4B5563', lineHeight: 20 },

  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyAbbrev: { fontSize: 18, fontWeight: '900', color: '#6C63FF' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeIconAbbrev: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  entryTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  entryDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  entryNote: { fontSize: 12, color: '#636366', marginTop: 4 },
  durationBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  durationText: { fontSize: 13, fontWeight: '800' },
  delBtn: { backgroundColor: '#FFF0F1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  delBtnText: { fontSize: 12, fontWeight: '700', color: '#FF4757' },

  modalOverlay: { flex: 1, backgroundColor: '#00000040' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F2F2F7', borderWidth: 1.5, borderColor: 'transparent' },
  typeAbbrevBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  typeAbbrev: { fontSize: 10, fontWeight: '900' },
  typeLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A2E', borderWidth: 1.5, borderColor: '#E5E5EA', fontWeight: '600' },
  saveBtn: { backgroundColor: '#6C63FF', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  fab: { position: 'absolute', left: 20, right: 20, backgroundColor: '#6C63FF', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#6C63FF', shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
