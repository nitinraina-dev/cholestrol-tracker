import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const NOTES_KEY = 'doctor_notes';

async function getNotes() {
  const raw = await AsyncStorage.getItem(NOTES_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function deleteNote(id) {
  const existing = await getNotes();
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(existing.filter(n => n.id !== id)));
}

function NoteCard({ note, onDelete, onEdit }) {
  const dateLabel = note.date
    ? new Date(note.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'No date';

  return (
    <View style={styles.noteCard}>
      <View style={styles.noteCardTop}>
        <View style={styles.noteIconBox}>
          <Text style={styles.noteIconText}>DR</Text>
        </View>
        <View style={{ flex: 1 }}>
          {note.doctorName ? (
            <Text style={styles.doctorName}>Dr. {note.doctorName}</Text>
          ) : (
            <Text style={styles.doctorNameEmpty}>Doctor's Visit</Text>
          )}
          <Text style={styles.noteDate}>{dateLabel}</Text>
        </View>
        <View style={styles.noteActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(note)}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(note.id)}>
            <Text style={styles.deleteBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.noteDivider} />

      <Text style={styles.noteText}>{note.note}</Text>

      {note.nextVisit ? (
        <View style={styles.nextVisitBox}>
          <View style={styles.nextVisitDot} />
          <Text style={styles.nextVisitText}>Next visit: {note.nextVisit}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DoctorNotesScreen({ navigation }) {
  const [notes, setNotes] = useState([]);

  const load = useCallback(async () => { setNotes(await getNotes()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = (id) => {
    Alert.alert('Delete Note', 'Remove this doctor note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteNote(id); load(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {notes.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyAbbrev}>DR</Text>
            </View>
            <Text style={styles.emptyTitle}>No doctor notes yet</Text>
            <Text style={styles.emptyHint}>Save notes from your appointments and track advice over time</Text>
          </View>
        ) : (
          notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={confirmDelete}
              onEdit={note => navigation.navigate('AddDoctorNote', { note })}
            />
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddDoctorNote')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>Add Doctor Note</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2FF' },
  scroll: { padding: 16, paddingBottom: 110 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyAbbrev: { fontSize: 20, fontWeight: '900', color: '#6C63FF', letterSpacing: 1 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },

  noteCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#6C63FF', shadowOpacity: 0.07, shadowRadius: 12, elevation: 2,
    borderLeftWidth: 3, borderLeftColor: '#6C63FF',
  },
  noteCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  noteIconBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  noteIconText: { fontSize: 11, fontWeight: '900', color: '#6C63FF', letterSpacing: 0.5 },
  doctorName: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  doctorNameEmpty: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  noteDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  noteActions: { flexDirection: 'row', gap: 6 },
  editBtn: { backgroundColor: '#EEF0FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#6C63FF' },
  deleteBtn: { backgroundColor: '#FFF0F1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#FF4757' },
  noteDivider: { height: 1, backgroundColor: '#F0F2FF', marginBottom: 12 },
  noteText: { fontSize: 14, color: '#2D3748', lineHeight: 22 },
  nextVisitBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: '#EEF0FF', padding: 10, borderRadius: 12 },
  nextVisitDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6C63FF' },
  nextVisitText: { fontSize: 13, color: '#6C63FF', fontWeight: '600' },

  fab: {
    position: 'absolute', bottom: 24, left: 20, right: 20,
    backgroundColor: '#6C63FF', padding: 18, borderRadius: 18, alignItems: 'center',
    shadowColor: '#6C63FF', shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
