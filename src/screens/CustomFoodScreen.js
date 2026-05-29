import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCustomFoods, saveCustomFood, deleteCustomFood } from '../services/customFoodStorage';

const RISK_COLORS = { YES: '#00C48C', 'IN MODERATION': '#FF9F0A', AVOID: '#FF4757' };
const RISK_ABBREV = { YES: 'OK', 'IN MODERATION': 'MOD', AVOID: 'NO' };

const EMPTY_NUTRIENTS = { saturatedFat: '', transFat: '', cholesterol: '', sugar: '', fiber: '', omega3: '', protein: '' };
const NUTRIENT_LABELS = [
  { key: 'saturatedFat', label: 'Saturated Fat', unit: 'g' },
  { key: 'transFat',     label: 'Trans Fat',      unit: 'g' },
  { key: 'cholesterol',  label: 'Cholesterol',    unit: 'mg' },
  { key: 'sugar',        label: 'Sugar',           unit: 'g' },
  { key: 'fiber',        label: 'Fiber',           unit: 'g' },
  { key: 'omega3',       label: 'Omega-3',         unit: 'g' },
  { key: 'protein',      label: 'Protein',         unit: 'g' },
];

function AddFoodModal({ visible, onClose, onSave, editing }) {
  const [name, setName] = useState(editing?.name || '');
  const [servingNote, setServingNote] = useState(editing?.servingNote || '');
  const [canEat, setCanEat] = useState(editing?.canEat || 'IN MODERATION');
  const [nutrients, setNutrients] = useState(() => {
    if (editing?.nutrients) {
      const n = {};
      Object.keys(EMPTY_NUTRIENTS).forEach(k => { n[k] = editing.nutrients[k]?.toString() || ''; });
      return n;
    }
    return { ...EMPTY_NUTRIENTS };
  });

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Enter a food name'); return; }
    const parsedNutrients = {};
    Object.keys(nutrients).forEach(k => {
      const v = parseFloat(nutrients[k]);
      parsedNutrients[k] = isNaN(v) ? 0 : v;
    });
    await onSave({
      id: editing?.id,
      name: name.trim(),
      servingNote: servingNote.trim(),
      canEat,
      nutrients: parsedNutrients,
      source: editing?.source || 'manual',
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{editing ? 'Edit Food' : 'Add Custom Food'}</Text>

          <Text style={styles.fieldLabel}>Food Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Dal Tadka, Grilled Salmon" placeholderTextColor="#C5C6D0" autoFocus />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Serving Size</Text>
          <TextInput style={styles.input} value={servingNote} onChangeText={setServingNote} placeholder="e.g. 1 bowl ~200g" placeholderTextColor="#C5C6D0" />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Can I Eat This?</Text>
          <View style={styles.canEatRow}>
            {['YES', 'IN MODERATION', 'AVOID'].map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.canEatChip, canEat === opt && { backgroundColor: (RISK_COLORS[opt] || '#9CA3AF') + '20', borderColor: RISK_COLORS[opt] }]}
                onPress={() => setCanEat(opt)}
                activeOpacity={0.8}
              >
                <Text style={[styles.canEatText, canEat === opt && { color: RISK_COLORS[opt] }]}>{RISK_ABBREV[opt]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Nutrients (per serving)</Text>
          {NUTRIENT_LABELS.map(({ key, label, unit }) => (
            <View key={key} style={styles.nutrientRow}>
              <Text style={styles.nutrientLabel}>{label}</Text>
              <TextInput
                style={styles.nutrientInput}
                value={nutrients[key]}
                onChangeText={v => setNutrients(prev => ({ ...prev, [key]: v }))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#C5C6D0"
              />
              <Text style={styles.nutrientUnit}>{unit}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{editing ? 'Update Food' : 'Save Food'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CustomFoodScreen() {
  const insets = useSafeAreaInsets();
  const [foods, setFoods] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => setFoods(await getCustomFoods()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id, name) => {
    Alert.alert('Delete', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCustomFood(id); load(); } },
    ]);
  };

  const filtered = search.trim()
    ? foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : foods;

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search saved foods..."
          placeholderTextColor="#C5C6D0"
        />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyAbbrev}>CF</Text>
            </View>
            <Text style={styles.emptyTitle}>{search ? 'No results' : 'No custom foods'}</Text>
            <Text style={styles.emptyHint}>
              {search ? 'Try a different search term.' : 'Save frequently eaten meals here so you can log them quickly without rescanning every time.'}
            </Text>
          </View>
        )}

        {filtered.map(food => {
          const color = RISK_COLORS[food.canEat] || '#9CA3AF';
          const abbrev = RISK_ABBREV[food.canEat] || '?';
          return (
            <View key={food.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.canEatBox, { backgroundColor: color + '18' }]}>
                  <Text style={[styles.canEatBoxText, { color }]}>{abbrev}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foodName}>{food.name}</Text>
                  {food.servingNote ? <Text style={styles.foodServing}>{food.servingNote}</Text> : null}
                  <Text style={styles.foodSource}>{food.source === 'scan' ? 'From scan' : 'Manual entry'} · {new Date(food.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                </View>
                <TouchableOpacity onPress={() => { setEditing(food); setShowModal(true); }} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(food.id, food.name)} style={styles.delBtn}>
                  <Text style={styles.delBtnText}>Del</Text>
                </TouchableOpacity>
              </View>

              {food.nutrients && (
                <View style={styles.nutrientsChips}>
                  {food.nutrients.fiber > 0 && (
                    <View style={styles.chip}><Text style={styles.chipText}>Fiber {food.nutrients.fiber}g</Text></View>
                  )}
                  {food.nutrients.saturatedFat > 0 && (
                    <View style={[styles.chip, { backgroundColor: '#FF475710' }]}>
                      <Text style={[styles.chipText, { color: '#FF4757' }]}>Sat.Fat {food.nutrients.saturatedFat}g</Text>
                    </View>
                  )}
                  {food.nutrients.protein > 0 && (
                    <View style={[styles.chip, { backgroundColor: '#3B82F610' }]}>
                      <Text style={[styles.chipText, { color: '#3B82F6' }]}>Protein {food.nutrients.protein}g</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => { setEditing(null); setShowModal(true); }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>Add Custom Food</Text>
      </TouchableOpacity>

      <AddFoodModal
        visible={showModal}
        editing={editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onSave={async (data) => { await saveCustomFood(data); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  searchBox: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA' },
  searchInput: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#1A1A2E', fontWeight: '500' },
  scroll: { padding: 16 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyAbbrev: { fontSize: 20, fontWeight: '900', color: '#6C63FF', letterSpacing: 1 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 10 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  canEatBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  canEatBoxText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  foodName: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  foodServing: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  foodSource: { fontSize: 11, color: '#C5C6D0', marginTop: 2 },
  editBtn: { backgroundColor: '#EEF0FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#6C63FF' },
  delBtn: { backgroundColor: '#FFF0F1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  delBtnText: { fontSize: 12, fontWeight: '700', color: '#FF4757' },
  nutrientsChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: '#00C48C10', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { fontSize: 11, fontWeight: '700', color: '#00C48C' },

  overlay: { flex: 1, backgroundColor: '#00000040' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingHorizontal: 24, paddingTop: 16 },
  handle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A2E', borderWidth: 1.5, borderColor: '#E5E5EA', fontWeight: '600' },
  canEatRow: { flexDirection: 'row', gap: 8 },
  canEatChip: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F2F2F7', borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center' },
  canEatText: { fontSize: 12, fontWeight: '800', color: '#9CA3AF' },
  nutrientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  nutrientLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#4B5563' },
  nutrientInput: { width: 70, backgroundColor: '#F2F2F7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', borderWidth: 1.5, borderColor: '#E5E5EA' },
  nutrientUnit: { fontSize: 12, color: '#9CA3AF', marginLeft: 6, width: 24 },
  saveBtn: { backgroundColor: '#6C63FF', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  fab: { position: 'absolute', left: 20, right: 20, backgroundColor: '#6C63FF', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#6C63FF', shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
