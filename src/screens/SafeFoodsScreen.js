import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Image, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMeals } from '../services/storage';

export default function SafeFoodsScreen() {
  const [safeFoods, setSafeFoods] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const meals = await getMeals();
    const safe = meals
      .filter(m => m.analysis?.riskLevel === 'LOW' && m.analysis?.riskScore <= 3)
      .reduce((acc, meal) => {
        const key = meal.analysis.foods?.join(',') || 'unknown';
        if (!acc.find(m => m.analysis.foods?.join(',') === key)) acc.push(meal);
        return acc;
      }, [])
      .slice(0, 30);
    setSafeFoods(safe);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!safeFoods.length) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyCircle}>
        <View style={styles.emptyCheck} />
      </View>
        <Text style={styles.emptyTitle}>No safe foods yet</Text>
        <Text style={styles.emptyHint}>Meals you scan with LOW risk (score 1–3) will appear here for quick reference</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={safeFoods}
      keyExtractor={m => m.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C48C" />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{safeFoods.length} Safe Foods Found</Text>
          <Text style={styles.headerSub}>These meals had LOW cholesterol risk when you scanned them</Text>
        </View>
      }
      renderItem={({ item: meal }) => (
        <View style={styles.card}>
          {meal.imageUri
            ? <Image source={{ uri: meal.imageUri }} style={styles.thumb} />
            : <View style={[styles.thumb, styles.thumbPlaceholder]}><View style={styles.thumbIcon} /></View>
          }
          <View style={styles.info}>
            <Text style={styles.foods} numberOfLines={2}>{meal.analysis?.foods?.join(', ') || 'Unknown'}</Text>
            <View style={styles.tags}>
              <View style={styles.riskTag}>
                <View style={styles.riskTagDot} />
                <Text style={styles.riskTagText}>Risk {meal.analysis?.riskScore}/10</Text>
              </View>
              {meal.analysis?.nutrients?.fiber > 3 && (
                <View style={styles.tag}><Text style={styles.tagText}>High Fiber</Text></View>
              )}
              {meal.analysis?.nutrients?.omega3 > 0.5 && (
                <View style={styles.tag}><Text style={styles.tagText}>Omega-3</Text></View>
              )}
            </View>
            {meal.analysis?.recommendation && (
              <Text style={styles.rec} numberOfLines={2}>{meal.analysis.recommendation}</Text>
            )}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2FF' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F2FF', padding: 32 },
  emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyCheck: { width: 36, height: 20, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#00C48C', transform: [{ rotate: '45deg' }], marginTop: -8 },
  thumbIcon: { width: 32, height: 26, borderRadius: 5, borderWidth: 2, borderColor: '#00C48C', opacity: 0.5 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },

  header: { marginBottom: 16 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  headerSub: { fontSize: 13, color: '#9CA3AF' },

  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, padding: 14,
    marginBottom: 12, gap: 12, alignItems: 'flex-start',
    shadowColor: '#00C48C', shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
    borderLeftWidth: 3, borderLeftColor: '#00C48C',
  },
  thumb: { width: 70, height: 70, borderRadius: 14 },
  thumbPlaceholder: { backgroundColor: '#E6FBF5', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  foods: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  riskTag: { backgroundColor: '#E6FBF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  riskTagDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#00C48C' },
  riskTagText: { fontSize: 11, color: '#00875A', fontWeight: '700' },
  tag: { backgroundColor: '#EEF0FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 11, color: '#6C63FF', fontWeight: '600' },
  rec: { fontSize: 12, color: '#9CA3AF', lineHeight: 17 },
});
