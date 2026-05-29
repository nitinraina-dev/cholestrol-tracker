import React, { useState, useLayoutEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { saveMedication, updateMedication } from '../services/medicationStorage';

const FREQUENCIES = [
  { key: 'daily',    label: 'Daily' },
  { key: 'twice',    label: 'Twice daily' },
  { key: 'weekly',   label: 'Weekly' },
  { key: 'asneeded', label: 'As needed' },
];

export default function AddMedicationScreen({ route, navigation }) {
  const editing = route.params?.med;
  const [name, setName] = useState(editing?.name || '');
  const [dose, setDose] = useState(editing?.dose || '');
  const [frequency, setFrequency] = useState(editing?.frequency || 'daily');
  const [note, setNote] = useState(editing?.note || '');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSave} style={{ marginRight: 4 }}>
          <Text style={{ color: '#6C63FF', fontWeight: '800', fontSize: 16 }}>Save</Text>
        </TouchableOpacity>
      ),
    });
  }, [name, dose, frequency, note]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Enter medication name'); return; }
    const data = { name: name.trim(), dose: dose.trim(), frequency, note: note.trim(), startDate: editing?.startDate || new Date().toISOString() };
    if (editing) {
      await updateMedication(editing.id, data);
    } else {
      await saveMedication(data);
    }
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

      <View style={styles.section}>
        <Text style={styles.label}>Medication Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Atorvastatin, Rosuvastatin"
          placeholderTextColor="#C5C6D0"
          autoFocus
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Dose</Text>
        <TextInput
          style={styles.input}
          value={dose}
          onChangeText={setDose}
          placeholder="e.g. 10 mg, 20 mg"
          placeholderTextColor="#C5C6D0"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Frequency</Text>
        <View style={styles.freqGrid}>
          {FREQUENCIES.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.freqChip, frequency === f.key && styles.freqChipActive]}
              onPress={() => setFrequency(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.freqLabel, frequency === f.key && styles.freqLabelActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Take after dinner, avoid grapefruit"
          placeholderTextColor="#C5C6D0"
          multiline
        />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
        <Text style={styles.saveBtnText}>{editing ? 'Update Medication' : 'Add Medication'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  label: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A2E', borderWidth: 1.5, borderColor: '#E5E5EA', fontWeight: '600' },
  freqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F2F2F7', borderWidth: 1.5, borderColor: 'transparent' },
  freqChipActive: { backgroundColor: '#EEF0FF', borderColor: '#6C63FF' },
  freqLabel: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  freqLabelActive: { color: '#6C63FF' },
  saveBtn: { backgroundColor: '#6C63FF', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8, shadowColor: '#6C63FF', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
