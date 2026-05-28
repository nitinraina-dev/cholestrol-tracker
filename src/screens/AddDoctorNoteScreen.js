import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTES_KEY = 'doctor_notes';

async function getNotes() {
  const raw = await AsyncStorage.getItem(NOTES_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveNote(note) {
  const existing = await getNotes();
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify([note, ...existing]));
}
async function updateNote(id, updates) {
  const existing = await getNotes();
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(
    existing.map(n => n.id === id ? { ...n, ...updates } : n)
  ));
}

export default function AddDoctorNoteScreen({ navigation, route }) {
  const existing = route.params?.note;

  const [form, setForm] = useState({
    doctorName: existing?.doctorName || '',
    date:       existing?.date       || new Date().toISOString().split('T')[0],
    note:       existing?.note       || '',
    nextVisit:  existing?.nextVisit  || '',
  });

  const save = useCallback(async () => {
    if (!form.note.trim()) { Alert.alert('Missing note', 'Please enter notes from the appointment.'); return; }
    if (existing) {
      await updateNote(existing.id, { doctorName: form.doctorName, date: form.date, note: form.note, nextVisit: form.nextVisit });
    } else {
      await saveNote({ id: Date.now().toString(), ...form, createdAt: new Date().toISOString() });
    }
    navigation.goBack();
  }, [form, existing, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Edit Note' : 'New Note',
      headerRight: () => (
        <TouchableOpacity onPress={save} hitSlop={{ top: 12, bottom: 12, left: 16, right: 4 }}>
          <Text style={s.headerSave}>Save</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, save, existing]);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.sectionLabel}>APPOINTMENT DETAILS</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.rowLabel}>Doctor</Text>
          <TextInput
            style={s.inlineInput}
            placeholder="Dr. Sharma (optional)"
            placeholderTextColor="#C5C6D0"
            value={form.doctorName}
            onChangeText={v => setForm(p => ({ ...p, doctorName: v }))}
          />
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.rowLabel}>Visit Date</Text>
          <TextInput
            style={s.inlineInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#C5C6D0"
            value={form.date}
            onChangeText={v => setForm(p => ({ ...p, date: v }))}
          />
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.rowLabel}>Next Visit</Text>
          <TextInput
            style={s.inlineInput}
            placeholder="e.g. 3 months (optional)"
            placeholderTextColor="#C5C6D0"
            value={form.nextVisit}
            onChangeText={v => setForm(p => ({ ...p, nextVisit: v }))}
          />
        </View>
      </View>

      <Text style={[s.sectionLabel, { marginTop: 24 }]}>NOTES FROM APPOINTMENT</Text>
      <TextInput
        style={s.textArea}
        placeholder="What did your doctor say? Diet changes, medication updates, targets to hit before next visit..."
        placeholderTextColor="#C5C6D0"
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        value={form.note}
        onChangeText={v => setForm(p => ({ ...p, note: v }))}
      />

      <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.85}>
        <Text style={s.saveBtnText}>{existing ? 'Update Note' : 'Save Note'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2FF' },
  content: { padding: 20, paddingBottom: 48 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.8, marginBottom: 10 },

  card: {
    backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    shadowColor: '#6C63FF', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowLabel: { width: 90, fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  divider: { height: 0.5, backgroundColor: '#EEF0FF', marginHorizontal: 16 },
  inlineInput: { flex: 1, fontSize: 14, color: '#1A1A2E', minHeight: 22 },

  textArea: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    fontSize: 14, color: '#1A1A2E', minHeight: 160,
    shadowColor: '#6C63FF', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },

  saveBtn: {
    backgroundColor: '#6C63FF', padding: 18, borderRadius: 16,
    alignItems: 'center', marginTop: 28,
    shadowColor: '#6C63FF', shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerSave: { color: '#6C63FF', fontSize: 16, fontWeight: '800' },
});
