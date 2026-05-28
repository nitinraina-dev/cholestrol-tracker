import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMeals, deleteMeal } from '../services/storage';
import RiskBadge from '../components/RiskBadge';

function groupByDate(meals) {
  const groups = {};
  meals.forEach(m => {
    const date = new Date(m.timestamp).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(m);
  });
  return Object.entries(groups).map(([date, items]) => ({ date, items }));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (d.toDateString() === today) return 'Today';
  if (d.toDateString() === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

function avgRisk(items) {
  const scored = items.filter(m => m.analysis?.riskScore != null);
  if (!scored.length) return null;
  return scored.reduce((s, m) => s + m.analysis.riskScore, 0) / scored.length;
}

export default function HistoryScreen({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const meals = await getMeals();
    setGroups(groupByDate(meals));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const confirmDelete = (meal) => {
    Alert.alert('Delete Meal', 'Remove this meal from your log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteMeal(meal.id); load(); } },
    ]);
  };

  if (!groups.length) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIllustration} />
        <Text style={styles.emptyTitle}>No meals logged yet</Text>
        <Text style={styles.emptyHint}>Start scanning meals to build your history</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
      data={groups}
      keyExtractor={g => g.date}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
      ListHeaderComponent={<View style={{ height: 8 }} />}
      renderItem={({ item: group }) => {
        const risk = avgRisk(group.items);
        const riskColor = risk == null ? '#9CA3AF' : risk >= 7 ? '#FF4757' : risk >= 4 ? '#FF8C00' : '#00C48C';
        return (
          <View style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupDate}>{formatDate(group.date)}</Text>
              {risk != null && (
                <View style={[styles.groupRiskBadge, { backgroundColor: riskColor + '22' }]}>
                  <Text style={[styles.groupRiskText, { color: riskColor }]}>Avg {risk.toFixed(1)}/10</Text>
                </View>
              )}
            </View>

            {group.items.map(meal => (
              <TouchableOpacity
                key={meal.id}
                style={styles.mealCard}
                onPress={() => navigation.navigate('MealDetail', { meal })}
                onLongPress={() => confirmDelete(meal)}
                activeOpacity={0.75}
              >
                {meal.imageUri
                  ? <Image source={{ uri: meal.imageUri }} style={styles.thumb} />
                  : <View style={[styles.thumb, styles.thumbPlaceholder]}><View style={styles.thumbIcon} /></View>
                }
                <View style={styles.mealInfo}>
                  <Text style={styles.mealFoods} numberOfLines={1}>
                    {meal.analysis?.foods?.join(', ') || 'Unknown meal'}
                  </Text>
                  <Text style={styles.mealTime}>
                    {new Date(meal.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {meal.analysis?.nutrients && (
                    <View style={styles.nutrientPills}>
                      <View style={styles.nutrientPill}>
                        <Text style={styles.nutrientPillText}>Sat.Fat {(meal.analysis.nutrients.saturatedFat || 0).toFixed(1)}g</Text>
                      </View>
                      <View style={styles.nutrientPill}>
                        <Text style={styles.nutrientPillText}>Sugar {(meal.analysis.nutrients.sugar || 0).toFixed(1)}g</Text>
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.mealRight}>
                  {meal.analysis && <RiskBadge level={meal.analysis.riskLevel} score={meal.analysis.riskScore} />}
                  <Text style={styles.deleteHint}>Hold to delete</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2FF' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F2FF', padding: 32 },
  emptyIllustration: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  group: { marginBottom: 8 },
  groupHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  groupDate: { fontSize: 14, fontWeight: '800', color: '#1A1A2E' },
  groupRiskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  groupRiskText: { fontSize: 12, fontWeight: '700' },

  mealCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 18, padding: 12,
    shadowColor: '#6C63FF', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
  },
  thumb: { width: 60, height: 60, borderRadius: 14 },
  thumbPlaceholder: { backgroundColor: '#F0F2FF', alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { width: 26, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#C7C7CC' },
  mealInfo: { flex: 1 },
  mealFoods: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 3 },
  mealTime: { fontSize: 12, color: '#9CA3AF' },
  nutrientPills: { flexDirection: 'row', gap: 6, marginTop: 6 },
  nutrientPill: { backgroundColor: '#F0F2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  nutrientPillText: { fontSize: 11, color: '#6C63FF', fontWeight: '600' },
  mealRight: { alignItems: 'flex-end', gap: 6 },
  deleteHint: { fontSize: 10, color: '#D1D5DB' },
});
