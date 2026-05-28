import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMealSuggestions, RateLimitError } from '../services/gemini';
import { getLatestReport } from '../services/reportStorage';
import { getDietPreference, DIET_OPTIONS, getLanguagePreference, LANGUAGE_OPTIONS } from '../services/settingsStorage';

const CARD_COLORS = ['#6C63FF', '#00C48C', '#FF8C00', '#FF6B9D', '#3B82F6', '#8B5CF6'];

function SuggestionCard({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const color = CARD_COLORS[index % CARD_COLORS.length];

  const handlePress = () => setExpanded(!expanded);

  const totalTime = (item.prepTime || 0) + (item.cookTime || 0);

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      {/* Always-visible header */}
      <View style={styles.cardHeader}>
        <View style={[styles.cardIndex, { backgroundColor: color }]}>
          <Text style={styles.cardIndexText}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.name}</Text>
          <View style={styles.cardMeta}>
            <View style={[styles.safeTag, { backgroundColor: color + '18', borderColor: color + '44' }]}>
              <View style={[styles.safeTagDot, { backgroundColor: color }]} />
              <Text style={[styles.safeTagText, { color }]}>Safe</Text>
            </View>
            {totalTime > 0 && (
              <Text style={styles.cardMetaExtra}>{totalTime} min</Text>
            )}
            {item.servings > 0 && (
              <Text style={styles.cardMetaExtra}>Serves {item.servings}</Text>
            )}
          </View>
        </View>
        <View style={[styles.chevron, expanded && styles.chevronUp]}>
          <View style={styles.chevronMark} />
        </View>
      </View>

      {/* Expanded recipe */}
      {expanded && (
        <>
          <View style={[styles.expandDivider, { backgroundColor: color + '30' }]} />
          <View style={styles.expandBody}>
            {/* Prep / Cook / Servings */}
            {(item.prepTime > 0 || item.cookTime > 0) && (
              <View style={styles.timeRow}>
                {item.prepTime > 0 && (
                  <View style={styles.timeChip}>
                    <Text style={styles.timeChipLabel}>Prep</Text>
                    <Text style={styles.timeChipVal}>{item.prepTime} min</Text>
                  </View>
                )}
                {item.cookTime > 0 && (
                  <View style={styles.timeChip}>
                    <Text style={styles.timeChipLabel}>Cook</Text>
                    <Text style={styles.timeChipVal}>{item.cookTime} min</Text>
                  </View>
                )}
                {item.servings > 0 && (
                  <View style={styles.timeChip}>
                    <Text style={styles.timeChipLabel}>Serves</Text>
                    <Text style={styles.timeChipVal}>{item.servings}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Description */}
            <Text style={styles.cardDesc}>{item.description}</Text>

            {/* Ingredients */}
            {item.ingredients?.length > 0 && (
              <View style={styles.recipeBlock}>
                <Text style={styles.recipeBlockTitle}>INGREDIENTS</Text>
                <View style={styles.ingredientGrid}>
                  {item.ingredients.map((ing, i) => (
                    <View key={i} style={styles.ingredientItem}>
                      <View style={[styles.ingDot, { backgroundColor: color }]} />
                      <Text style={styles.ingText}>{ing}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Steps */}
            {item.steps?.length > 0 && (
              <View style={styles.recipeBlock}>
                <Text style={styles.recipeBlockTitle}>HOW TO COOK</Text>
                {item.steps.map((step, i) => (
                  <View key={i} style={styles.stepItem}>
                    <View style={[styles.stepBadge, { backgroundColor: color }]}>
                      <Text style={styles.stepBadgeText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Nutrients */}
            <View style={styles.nutrientRow}>
              {item.nutrients?.fiber != null && (
                <View style={styles.nutrientChip}>
                  <Text style={styles.nutrientLabel}>Fiber</Text>
                  <Text style={styles.nutrientVal}>{item.nutrients.fiber}g</Text>
                </View>
              )}
              {item.nutrients?.omega3 != null && item.nutrients.omega3 > 0 && (
                <View style={styles.nutrientChip}>
                  <Text style={styles.nutrientLabel}>Omega-3</Text>
                  <Text style={styles.nutrientVal}>{item.nutrients.omega3}g</Text>
                </View>
              )}
              {item.nutrients?.saturatedFat != null && (
                <View style={styles.nutrientChip}>
                  <Text style={styles.nutrientLabel}>Sat. Fat</Text>
                  <Text style={styles.nutrientVal}>{item.nutrients.saturatedFat}g</Text>
                </View>
              )}
            </View>

            {/* Chef tip */}
            {item.tip && (
              <View style={[styles.tipBox, { backgroundColor: color + '12', borderColor: color + '30' }]}>
                <View style={[styles.tipDot, { backgroundColor: color }]} />
                <Text style={[styles.tipText, { color }]}>{item.tip}</Text>
              </View>
            )}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function SuggestionsScreen() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [diet, setDiet] = useState('omnivore');
  const [language, setLanguage] = useState('english');
  const [hasReport, setHasReport] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const fetchRef = useRef(null); // always points to latest fetchSuggestions
  const retryCountRef = useRef(0);

  const load = useCallback(async () => {
    const [d, report, lang] = await Promise.all([getDietPreference(), getLatestReport(), getLanguagePreference()]);
    setDiet(d);
    setHasReport(!!report);
    setLanguage(lang);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Countdown effect — ticks every second, auto-retries when it reaches 0
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { fetchRef.current?.(); return; }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const fetchSuggestions = async () => {
    setLoading(true);
    setCountdown(null);
    setError(null);
    try {
      const report = await getLatestReport();
      const results = await getMealSuggestions(report, diet, language);
      retryCountRef.current = 0;
      setSuggestions(results);
    } catch (e) {
      if (e instanceof RateLimitError && retryCountRef.current < 2 && (e.waitMs || 0) <= 120000) {
        retryCountRef.current++;
        setCountdown(Math.ceil((e.waitMs || 60000) / 1000));
      } else {
        retryCountRef.current = 0;
        setError('Could not load suggestions. Please try again in a few minutes.');
      }
    } finally {
      setLoading(false);
    }
  };
  fetchRef.current = fetchSuggestions;

  const dietOption = DIET_OPTIONS.find(d => d.key === diet) || DIET_OPTIONS[2];
  const langOption = LANGUAGE_OPTIONS.find(l => l.key === language);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>AI SUGGESTIONS</Text>
        <Text style={styles.heroTitle}>What Can I Eat?</Text>
        <Text style={styles.heroSub}>Safe meals with full recipes, based on your diet and blood report</Text>

        <View style={styles.pillRow}>
          <View style={styles.dietChip}>
            <Text style={styles.dietChipText}>{dietOption.label}</Text>
          </View>
          {langOption && langOption.key !== 'english' && (
            <View style={styles.langChip}>
              <Text style={styles.langChipText}>{langOption.native}</Text>
            </View>
          )}
          {hasReport && (
            <View style={styles.reportChip}>
              <View style={styles.reportChipDot} />
              <Text style={styles.reportChipText}>Blood report active</Text>
            </View>
          )}
        </View>
      </View>

      {suggestions.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <View style={styles.emptyIconBar1} />
            <View style={styles.emptyIconBar2} />
            <View style={styles.emptyIconBar3} />
          </View>
          <Text style={styles.emptyTitle}>Tap below to get meal ideas</Text>
          <Text style={styles.emptyHint}>AI will suggest 6 safe Indian meals personalised to your blood report</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <View style={styles.errorDot} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.listTitle}>6 Safe Meals — Tap any card for the full recipe</Text>
          {suggestions.map((item, i) => (
            <SuggestionCard key={i} item={item} index={i} />
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.generateBtn, (loading || countdown !== null) && styles.generateBtnDisabled]}
        onPress={fetchSuggestions}
        disabled={loading || countdown !== null}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : countdown !== null ? (
          <Text style={styles.generateBtnText}>Generating in {countdown}s...</Text>
        ) : (
          <Text style={styles.generateBtnText}>
            {suggestions.length ? 'Regenerate Suggestions' : 'Get Meal Suggestions'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footer}>Change diet preference in Settings (More tab)</Text>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  hero: {
    backgroundColor: '#0A0A14', padding: 28, paddingTop: 36,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 16,
  },
  heroLabel: { fontSize: 11, fontWeight: '700', color: '#6C63FF', letterSpacing: 1.5, marginBottom: 8 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 6 },
  heroSub: { fontSize: 13, color: '#8E8E93', marginBottom: 18, lineHeight: 18 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dietChip: { backgroundColor: '#6C63FF22', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#6C63FF44' },
  dietChipText: { fontSize: 12, color: '#8B7FF0', fontWeight: '700' },
  langChip: { backgroundColor: '#3B82F618', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#3B82F633' },
  langChipText: { fontSize: 12, color: '#3B82F6', fontWeight: '700' },
  reportChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00C48C18', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#00C48C33' },
  reportChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00C48C' },
  reportChipText: { fontSize: 12, color: '#00C48C', fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconBox: { flexDirection: 'row', gap: 5, alignItems: 'flex-end', marginBottom: 16, height: 36 },
  emptyIconBar1: { width: 10, height: 22, backgroundColor: '#6C63FF40', borderRadius: 3 },
  emptyIconBar2: { width: 10, height: 36, backgroundColor: '#6C63FF60', borderRadius: 3 },
  emptyIconBar3: { width: 10, height: 28, backgroundColor: '#6C63FF40', borderRadius: 3 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 32 },

  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, margin: 16, backgroundColor: '#FFF0F1', padding: 16, borderRadius: 14, borderLeftWidth: 3, borderLeftColor: '#FF4757' },
  errorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4757', marginTop: 3 },
  errorText: { fontSize: 13, color: '#CC2233', flex: 1, lineHeight: 18 },

  list: { paddingHorizontal: 16 },
  listTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  // Card shell
  card: {
    backgroundColor: '#fff', borderRadius: 20, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 14, elevation: 3,
  },

  // Collapsed header
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  cardIndex: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardIndexText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cardName: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  safeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  safeTagDot: { width: 5, height: 5, borderRadius: 2.5 },
  safeTagText: { fontSize: 11, fontWeight: '700' },
  cardMetaExtra: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  chevron: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  chevronMark: { width: 8, height: 8, borderRightWidth: 2, borderBottomWidth: 2, borderColor: '#9CA3AF', transform: [{ rotate: '45deg' }], marginTop: -4 },

  expandDivider: { height: 1, marginHorizontal: 16 },

  // Expand body
  expandBody: { padding: 16 },

  // Time chips
  timeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  timeChip: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 12, padding: 10, alignItems: 'center' },
  timeChipLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  timeChipVal: { fontSize: 14, fontWeight: '800', color: '#1A1A2E' },

  cardDesc: { fontSize: 13, color: '#555', lineHeight: 19, marginBottom: 16 },

  // Ingredients / Steps sections
  recipeBlock: { marginBottom: 18 },
  recipeBlockTitle: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, marginBottom: 10 },

  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  ingredientItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, width: '50%', paddingBottom: 7, paddingRight: 8 },
  ingDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  ingText: { fontSize: 12, color: '#374151', flex: 1, lineHeight: 17 },

  stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepBadge: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  stepText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 19 },

  // Nutrients
  nutrientRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  nutrientChip: { flex: 1, backgroundColor: '#F2F2F7', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center' },
  nutrientLabel: { fontSize: 10, color: '#8E8E93', fontWeight: '600', marginBottom: 2 },
  nutrientVal: { fontSize: 14, color: '#6C63FF', fontWeight: '800' },

  // Tip
  tipBox: { padding: 12, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1 },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4, flexShrink: 0 },
  tipText: { fontSize: 12, lineHeight: 17, flex: 1, fontWeight: '600' },

  // Generate button
  generateBtn: { margin: 16, backgroundColor: '#6C63FF', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#6C63FF', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  footer: { textAlign: 'center', fontSize: 12, color: '#C5C6D0', marginBottom: 8 },
});
