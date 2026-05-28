import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getTodaysMeals, calcDailyTotals } from '../services/storage';
import { getTodayWater, addWater, getWaterGoal, getDietPreference } from '../services/settingsStorage';
import { getStreakData, updateStreak } from '../services/streakStorage';
import { LogoFull } from '../components/Logo';
import RiskBadge from '../components/RiskBadge';
import NutrientRow from '../components/NutrientRow';
import { useTour } from '../contexts/TourContext';

const DAILY_TIPS = {
  veg: [
    'Replace white rice with brown rice or quinoa — lowers VLDL',
    'Add a handful of walnuts or flaxseed daily — reduces LDL',
    'Include rajma, chana or moong dal every day for soluble fiber',
    'Use mustard or olive oil instead of coconut oil or vanaspati',
    'Eat a bowl of oats for breakfast — beta-glucan cuts LDL by up to 10%',
    'Avoid paneer and full-fat dairy — swap for low-fat curd',
  ],
  nonveg: [
    'Choose grilled or steamed fish (rohu, salmon) over fried chicken',
    'Eat oily fish 2–3 times a week — omega-3 lowers triglycerides',
    'Remove chicken skin before cooking — it is mostly saturated fat',
    'Avoid red meat and organ meat — raises LDL and VLDL fast',
    'Pair meat with high-fiber vegetables to slow cholesterol absorption',
    'Boil or bake eggs instead of frying in butter or ghee',
  ],
  omnivore: [
    'Avoid fried food, ghee and butter — raises LDL',
    'Cut white rice and sweets — raises VLDL and TG',
    'Add oats, flaxseed and fish — lowers all three',
    'Aim for 25g+ fiber every day from vegetables and pulses',
    'Drink 2.5L of water daily to support lipid metabolism',
    'Walk for 30 minutes after dinner — proven to reduce triglycerides',
  ],
};

const DAILY_LIMITS = { saturatedFat: 20, transFat: 2, cholesterol: 200, sugar: 25 };

const AVOID_RULES = [
  { key: 'saturatedFat', threshold: 0.7, nutrient: 'Saturated Fat',       color: '#FF4757', foods: ['Butter & ghee', 'Full-fat dairy', 'Red meat', 'Coconut oil'] },
  { key: 'cholesterol',  threshold: 0.7, nutrient: 'Dietary Cholesterol',  color: '#FF8C00', foods: ['Egg yolks', 'Organ meats', 'Shellfish', 'Full-fat cheese'] },
  { key: 'sugar',        threshold: 0.8, nutrient: 'Added Sugar',          color: '#FF9F0A', foods: ['Sweets & mithai', 'Fruit juice', 'Soft drinks', 'White rice'] },
  { key: 'transFat',     threshold: 0.5, nutrient: 'Trans Fat',             color: '#FF4757', foods: ['Vanaspati', 'Packaged biscuits', 'Fried snacks', 'Margarine'] },
];

const RISK_LEVELS = [
  { max: 3,  label: 'Heart Healthy',  color: '#30D158', bg: '#30D15818' },
  { max: 5,  label: 'Moderate Risk',  color: '#FF9F0A', bg: '#FF9F0A18' },
  { max: 7,  label: 'Risky',          color: '#FF9F0A', bg: '#FF9F0A18' },
  { max: 10, label: 'High Risk',      color: '#FF453A', bg: '#FF453A18' },
];

function getRiskLevel(score) {
  return RISK_LEVELS.find(r => score <= r.max) || RISK_LEVELS[RISK_LEVELS.length - 1];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [meals, setMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [water, setWater] = useState(0);
  const [waterGoal, setWaterGoalState] = useState(2.5);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [diet, setDiet] = useState('omnivore');

  const scoreCardRef    = useRef(null);
  const waterSectionRef = useRef(null);
  const { registerRef } = useTour();
  useEffect(() => {
    registerRef('homeScoreCard', scoreCardRef);
    registerRef('homeWaterSection', waterSectionRef);
  }, [registerRef]);

  const load = useCallback(async () => {
    const [todayMeals, w, wGoal, streakData, d] = await Promise.all([
      getTodaysMeals(), getTodayWater(), getWaterGoal(), getStreakData(), getDietPreference(),
    ]);
    setMeals(todayMeals);
    setWater(w);
    setWaterGoalState(wGoal);
    setDiet(d);
    if (todayMeals.length > 0) {
      const avg = todayMeals.reduce((s, m) => s + (m.analysis?.riskScore || 0), 0) / todayMeals.length;
      const updatedStreak = await updateStreak(new Date().toDateString(), avg);
      setStreak(updatedStreak);
    } else {
      setStreak(streakData);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleAddWater = async (amt) => {
    const val = await addWater(amt);
    setWater(val);
  };

  const totals = calcDailyTotals(meals);
  const overallRisk = meals.length
    ? meals.reduce((sum, m) => sum + (m.analysis?.riskScore || 0), 0) / meals.length
    : null;
  const riskLevel = overallRisk != null ? getRiskLevel(overallRisk) : null;

  const avoidItems = AVOID_RULES.filter(r => (totals[r.key] || 0) >= DAILY_LIMITS[r.key] * r.threshold);

  const warnings = [
    totals.saturatedFat > DAILY_LIMITS.saturatedFat && `Sat. fat ${totals.saturatedFat.toFixed(1)}g`,
    totals.transFat     > DAILY_LIMITS.transFat     && `Trans fat ${totals.transFat.toFixed(1)}g`,
    totals.cholesterol  > DAILY_LIMITS.cholesterol  && `Cholesterol ${totals.cholesterol.toFixed(0)}mg`,
    totals.sugar        > DAILY_LIMITS.sugar        && `Sugar ${totals.sugar.toFixed(1)}g`,
  ].filter(Boolean);

  const waterPct = Math.min((water / waterGoal) * 100, 100);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ── */}
      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.heroRow}>
          <LogoFull iconSize={34} light />
          <View style={styles.heroRight}>
            {streak.current > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakNum}>{streak.current}</Text>
                <Text style={styles.streakLabel}> day streak</Text>
              </View>
            )}
            <Text style={styles.dateLabel}>
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        </View>

        <Text style={styles.greeting}>{getGreeting()}</Text>

        {/* Score Card */}
        <View ref={scoreCardRef} collapsable={false}>
          {riskLevel ? (
            <View style={[styles.scoreCard, { backgroundColor: riskLevel.bg }]}>
              <View style={styles.scoreLeft}>
                <Text style={[styles.scoreNum, { color: riskLevel.color }]}>
                  {overallRisk.toFixed(1)}
                </Text>
                <Text style={styles.scoreDenom}> / 10</Text>
              </View>
              <View style={styles.scoreRight}>
                <View style={[styles.riskIndicator, { backgroundColor: riskLevel.color }]} />
                <Text style={[styles.riskLabel, { color: riskLevel.color }]}>{riskLevel.label}</Text>
                <Text style={styles.mealCount}>{meals.length} meal{meals.length !== 1 ? 's' : ''} today</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.noMealsCard}
              onPress={() => navigation.navigate('CameraTab')}
              activeOpacity={0.8}
            >
              {/* Camera icon */}
              <View style={styles.noMealsCameraIcon}>
                <View style={styles.noMealsCameraBody}>
                  <View style={styles.noMealsCameraLens} />
                </View>
              </View>
              <Text style={styles.noMealsText}>No meals logged today</Text>
              <Text style={styles.noMealsHint}>Tap here to scan your first meal</Text>
              <View style={styles.noMealsCta}>
                <Text style={styles.noMealsCtaText}>Scan Now  →</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Warning Banner ── */}
      {warnings.length > 0 && (
        <View style={styles.warningBanner}>
          <View style={styles.warningDot} />
          <Text style={styles.warningText} numberOfLines={2}>
            Daily limits exceeded: {warnings.join('  ·  ')}
          </Text>
        </View>
      )}

      {/* ── Water ── */}
      <View ref={waterSectionRef} collapsable={false} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Water Intake</Text>
          <Text style={styles.sectionValue}>{water.toFixed(1)} / {waterGoal} L</Text>
        </View>
        <View style={styles.waterTrack}>
          <View style={[styles.waterFill, { width: `${waterPct}%` }]} />
        </View>
        <View style={styles.waterBtns}>
          {[0.25, 0.5, 1].map(amt => (
            <TouchableOpacity key={amt} style={styles.waterBtn} onPress={() => handleAddWater(amt)} activeOpacity={0.7}>
              <Text style={styles.waterBtnLabel}>+{amt} L</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Nutrients ── */}
      <Text style={styles.groupLabel}>TODAY'S NUTRIENTS</Text>
      <View style={styles.card}>
        <NutrientRow name="saturatedFat" value={totals.saturatedFat} />
        <View style={styles.divider} />
        <NutrientRow name="transFat"     value={totals.transFat} />
        <View style={styles.divider} />
        <NutrientRow name="cholesterol"  value={totals.cholesterol} />
        <View style={styles.divider} />
        <NutrientRow name="sugar"        value={totals.sugar} />
        <View style={styles.divider} />
        <NutrientRow name="fiber"        value={totals.fiber} />
        <View style={styles.divider} />
        <NutrientRow name="omega3"       value={totals.omega3} />
        <View style={styles.divider} />
        <NutrientRow name="protein"      value={totals.protein} />
      </View>

      {/* ── Avoid Today ── */}
      {avoidItems.length > 0 && (
        <>
          <Text style={styles.groupLabel}>AVOID FOR REST OF DAY</Text>
          <View style={[styles.card, styles.avoidCard]}>
            {avoidItems.map((item, i) => (
              <View key={item.key} style={[styles.avoidRow, i > 0 && styles.avoidRowBorder]}>
                <View style={[styles.avoidDot, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.avoidNutrient, { color: item.color }]}>{item.nutrient} limit nearly reached</Text>
                  <View style={styles.avoidChips}>
                    {item.foods.map(f => (
                      <View key={f} style={[styles.avoidChip, { backgroundColor: item.color + '14' }]}>
                        <Text style={[styles.avoidChipText, { color: item.color }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Meals ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.groupLabel}>TODAY'S MEALS</Text>
        {meals.length > 0 && (
          <View style={styles.mealBadge}>
            <Text style={styles.mealBadgeText}>{meals.length}</Text>
          </View>
        )}
      </View>
      <View style={styles.card}>
        {meals.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyPlate}>
              <View style={styles.emptyPlateInner} />
            </View>
            <Text style={styles.emptyStateText}>No meals yet — tap Scan to log one</Text>
          </View>
        ) : (
          meals.map((meal, i) => (
            <React.Fragment key={meal.id}>
              {i > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.mealRow}
                onPress={() => navigation.navigate('MealDetail', { meal })}
                activeOpacity={0.6}
              >
                {meal.imageUri
                  ? <Image source={{ uri: meal.imageUri }} style={styles.mealThumb} />
                  : <View style={styles.mealThumbEmpty}><View style={styles.mealThumbIcon} /></View>
                }
                <View style={styles.mealMeta}>
                  <Text style={styles.mealName} numberOfLines={1}>
                    {meal.analysis?.foods?.join(', ') || 'Unknown meal'}
                  </Text>
                  <Text style={styles.mealTime}>
                    {new Date(meal.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {meal.analysis && (
                  <RiskBadge level={meal.analysis.riskLevel} score={meal.analysis.riskScore} />
                )}
              </TouchableOpacity>
            </React.Fragment>
          ))
        )}
      </View>

      {/* ── Tips ── */}
      <Text style={styles.groupLabel}>DAILY TIPS</Text>
      <View style={styles.tipsCard}>
        {(DAILY_TIPS[diet] || DAILY_TIPS.omnivore).map((tip, i) => (
          <View key={i} style={[styles.tipRow, i > 0 && styles.tipRowBorder]}>
            <View style={styles.tipBullet} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },

  // Hero
  hero: { backgroundColor: '#0A0A14', paddingHorizontal: 24, paddingBottom: 28 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heroRight: { alignItems: 'flex-end', gap: 6 },
  greeting: { fontSize: 13, color: '#636366', fontWeight: '500', letterSpacing: 0.2, marginBottom: 16 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FF9F0A18', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: '#FF9F0A30',
  },
  streakNum: { fontSize: 14, fontWeight: '800', color: '#FF9F0A' },
  streakLabel: { fontSize: 12, fontWeight: '500', color: '#FF9F0A' },
  dateLabel: { fontSize: 12, color: '#636366', fontWeight: '500' },

  scoreCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 18, paddingVertical: 20, paddingHorizontal: 24,
  },
  scoreLeft: { flexDirection: 'row', alignItems: 'flex-end' },
  scoreNum: { fontSize: 52, fontWeight: '700', lineHeight: 56 },
  scoreDenom: { fontSize: 18, color: '#8E8E93', fontWeight: '500', marginBottom: 8 },
  scoreRight: { alignItems: 'flex-end', gap: 4 },
  riskIndicator: { width: 8, height: 8, borderRadius: 4 },
  riskLabel: { fontSize: 17, fontWeight: '700' },
  mealCount: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  noMealsCard: {
    backgroundColor: '#6C63FF18', borderRadius: 20, padding: 28, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#6C63FF44', borderStyle: 'dashed', gap: 8,
  },
  noMealsCameraIcon: { marginBottom: 4 },
  noMealsCameraBody: {
    width: 52, height: 40, borderRadius: 10, borderWidth: 2.5, borderColor: '#6C63FF',
    alignItems: 'center', justifyContent: 'center',
  },
  noMealsCameraLens: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#6C63FF' },
  noMealsText: { fontSize: 17, fontWeight: '700', color: '#fff', textAlign: 'center' },
  noMealsHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  noMealsCta: { marginTop: 4, backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12 },
  noMealsCtaText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Warning
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FF9F0A0E', borderRadius: 12,
    marginHorizontal: 16, marginTop: 16, padding: 14,
    borderWidth: 1, borderColor: '#FF9F0A25',
  },
  warningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9F0A' },
  warningText: { flex: 1, fontSize: 13, color: '#FF9F0A', fontWeight: '600', lineHeight: 18 },

  // Water
  section: { backgroundColor: '#fff', borderRadius: 16, margin: 16, marginBottom: 0, padding: 18, ...CARD_SHADOW },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  sectionValue: { fontSize: 13, color: '#6C63FF', fontWeight: '700' },
  waterTrack: { height: 6, backgroundColor: '#F2F2F7', borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
  waterFill: { height: 6, backgroundColor: '#6C63FF', borderRadius: 3 },
  waterBtns: { flexDirection: 'row', gap: 8 },
  waterBtn: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  waterBtnLabel: { fontSize: 13, fontWeight: '700', color: '#6C63FF' },

  // Group labels
  groupLabel: { fontSize: 11, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 24, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 24, marginBottom: 8 },
  mealBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center' },
  mealBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Cards
  card: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, padding: 16, ...CARD_SHADOW },
  divider: { height: 0.5, backgroundColor: '#E5E5EA', marginVertical: 2 },

  // Meals
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  mealThumb: { width: 52, height: 52, borderRadius: 12 },
  mealThumbEmpty: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  mealThumbIcon: { width: 22, height: 18, borderRadius: 3, borderWidth: 2, borderColor: '#C7C7CC' },
  mealMeta: { flex: 1 },
  mealName: { fontSize: 15, fontWeight: '600', color: '#000' },
  mealTime: { fontSize: 13, color: '#8E8E93', marginTop: 2 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyPlate: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyPlateInner: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#E5E5EA' },
  emptyStateText: { fontSize: 14, color: '#8E8E93' },

  // Avoid today
  avoidCard: { paddingVertical: 4 },
  avoidRow: { paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avoidRowBorder: { borderTopWidth: 0.5, borderTopColor: '#F2F2F7' },
  avoidDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 5 },
  avoidNutrient: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  avoidChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  avoidChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  avoidChipText: { fontSize: 12, fontWeight: '600' },

  // Tips
  tipsCard: { backgroundColor: '#0A0A14', borderRadius: 16, marginHorizontal: 16, padding: 20, marginBottom: 8 },
  tipRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8 },
  tipRowBorder: { borderTopWidth: 0.5, borderTopColor: '#ffffff14' },
  tipBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6C63FF', marginTop: 6 },
  tipText: { flex: 1, fontSize: 14, color: '#EBEBF5CC', lineHeight: 20 },
});
