import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProfiles, getActiveProfileId, setActiveProfile, saveProfile, deleteProfile } from '../services/profileStorage';

const AVATAR_COLORS = ['#6C63FF', '#00C48C', '#FF8C00', '#3B82F6', '#FF4757', '#8B5CF6'];

function getAvatarColor(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function getInitials(name) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function AddProfileModal({ visible, onClose, onSave, editing }) {
  const [name, setName] = useState(editing?.name || '');
  const [relation, setRelation] = useState(editing?.relation || '');

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Enter a name'); return; }
    await onSave({ id: editing?.id, name: name.trim(), relation: relation.trim() });
    setName(''); setRelation('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>{editing ? 'Edit Profile' : 'New Profile'}</Text>

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Dad, Mom, Me"
          placeholderTextColor="#C5C6D0"
          autoFocus
        />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Relation (optional)</Text>
        <TextInput
          style={styles.input}
          value={relation}
          onChangeText={setRelation}
          placeholder="e.g. Father, Self, Spouse"
          placeholderTextColor="#C5C6D0"
        />

        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>Each profile has its own meals, reports, medications, and settings. Switch between profiles anytime.</Text>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{editing ? 'Update Profile' : 'Create Profile'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function ProfilesScreen() {
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState('default');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const [p, a] = await Promise.all([getProfiles(), getActiveProfileId()]);
    setProfiles(p);
    setActiveId(a);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSwitch = async (id) => {
    await setActiveProfile(id);
    setActiveId(id);
    Alert.alert('Profile switched', `Now viewing data for ${profiles.find(p => p.id === id)?.name || id}`);
  };

  const handleDelete = (profile) => {
    if (profiles.length <= 1) { Alert.alert('Cannot delete the last profile'); return; }
    Alert.alert('Delete Profile', `Remove "${profile.name}"? All data for this profile will be lost.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { const updated = await deleteProfile(profile.id); setProfiles(updated); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Family Profiles</Text>
          <Text style={styles.infoText}>Create separate profiles for each family member. Each profile stores its own meals, blood reports, medications, and settings independently.</Text>
        </View>

        {profiles.map(profile => {
          const isActive = profile.id === activeId;
          const color = getAvatarColor(profile.name);
          const initials = getInitials(profile.name);
          return (
            <View key={profile.id} style={[styles.card, isActive && styles.cardActive]}>
              <View style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: color + '20', borderColor: isActive ? color : 'transparent', borderWidth: 2 }]}>
                  <Text style={[styles.avatarText, { color }]}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.profileName}>{profile.name}</Text>
                    {isActive && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>}
                  </View>
                  {profile.relation ? <Text style={styles.profileRelation}>{profile.relation}</Text> : null}
                  <Text style={styles.profileDate}>Created {new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardActions}>
                {!isActive && (
                  <TouchableOpacity style={styles.switchBtn} onPress={() => handleSwitch(profile.id)} activeOpacity={0.8}>
                    <Text style={styles.switchBtnText}>Switch to this profile</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.editBtn} onPress={() => { setEditing(profile); setShowModal(true); }}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                {profiles.length > 1 && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(profile)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => { setEditing(null); setShowModal(true); }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>Add Profile</Text>
      </TouchableOpacity>

      <AddProfileModal
        visible={showModal}
        editing={editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onSave={async (data) => { await saveProfile(data); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  scroll: { padding: 16 },

  infoCard: { backgroundColor: '#EEF0FF', borderRadius: 18, padding: 16, marginBottom: 16 },
  infoTitle: { fontSize: 15, fontWeight: '800', color: '#6C63FF', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#4B5563', lineHeight: 20 },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  cardActive: { borderWidth: 1.5, borderColor: '#6C63FF33' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  activeBadge: { backgroundColor: '#6C63FF18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#6C63FF' },
  profileRelation: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  profileDate: { fontSize: 11, color: '#C5C6D0', marginTop: 4 },
  cardDivider: { height: 1, backgroundColor: '#F2F2F7', marginBottom: 12 },
  cardActions: { flexDirection: 'row', gap: 8 },
  switchBtn: { flex: 1, backgroundColor: '#EEF0FF', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  switchBtnText: { fontSize: 13, fontWeight: '700', color: '#6C63FF' },
  editBtn: { backgroundColor: '#F2F2F7', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  deleteBtn: { backgroundColor: '#FFF0F1', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: '#FF4757' },

  overlay: { flex: 1, backgroundColor: '#00000040' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A2E', borderWidth: 1.5, borderColor: '#E5E5EA', fontWeight: '600' },
  noticeBox: { backgroundColor: '#FFF9E6', borderRadius: 12, padding: 12, marginTop: 14 },
  noticeText: { fontSize: 13, color: '#9B6E00', lineHeight: 18 },
  saveBtn: { backgroundColor: '#6C63FF', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 18 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  fab: { position: 'absolute', left: 20, right: 20, backgroundColor: '#6C63FF', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#6C63FF', shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
