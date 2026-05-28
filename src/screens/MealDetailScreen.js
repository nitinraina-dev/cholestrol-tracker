import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import RiskBadge from '../components/RiskBadge';
import NutrientRow from '../components/NutrientRow';

const CAN_EAT_CONFIG = {
  YES:             { color: '#00C48C', bg: '#E6FBF5', border: '#00C48C', label: 'Safe to eat' },
  'IN MODERATION': { color: '#FF8C00', bg: '#FFF8EC', border: '#FF8C00', label: 'Eat in moderation' },
  AVOID:           { color: '#FF4757', bg: '#FFF0F1', border: '#FF4757', label: 'Avoid this food' },
};

export default function MealDetailScreen({ route }) {
  const { meal } = route.params;
  const a = meal.analysis;
  const canEatCfg = a?.canEat ? (CAN_EAT_CONFIG[a.canEat] || CAN_EAT_CONFIG['IN MODERATION']) : null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {meal.imageUri && (
        <Image source={{ uri: meal.imageUri }} style={styles.image} resizeMode="cover" />
      )}

      <View style={styles.content}>
        {/* Can Eat Verdict */}
        {canEatCfg && (
          <View style={[styles.canEatCard, { backgroundColor: canEatCfg.bg, borderColor: canEatCfg.border }]}>
            <View style={[styles.canEatDot, { backgroundColor: canEatCfg.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.canEatLabel, { color: canEatCfg.color }]}>{canEatCfg.label}</Text>
              {a.personalizedAdvice && (
                <Text style={styles.canEatAdvice}>{a.personalizedAdvice}</Text>
              )}
            </View>
          </View>
        )}

        {/* Header */}
        <View style={styles.headerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.foods}>{a?.foods?.join(', ') || 'Unknown meal'}</Text>
            {a?.servingNote && <Text style={styles.serving}>{a.servingNote}</Text>}
            <Text style={styles.time}>
              {new Date(meal.timestamp).toLocaleString('en-IN', {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>
          {a && <RiskBadge level={a.riskLevel} score={a.riskScore} />}
        </View>

        {/* Nutrients */}
        {a?.nutrients && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Estimated Nutrients</Text>
            <NutrientRow name="saturatedFat" value={a.nutrients.saturatedFat || 0} />
            <NutrientRow name="transFat" value={a.nutrients.transFat || 0} />
            <NutrientRow name="cholesterol" value={a.nutrients.cholesterol || 0} />
            <NutrientRow name="sugar" value={a.nutrients.sugar || 0} />
            <NutrientRow name="fiber" value={a.nutrients.fiber || 0} />
            <NutrientRow name="omega3" value={a.nutrients.omega3 || 0} />
            <NutrientRow name="protein" value={a.nutrients.protein || 0} />
          </View>
        )}

        {/* Warnings */}
        {a?.warnings?.length > 0 && (
          <View style={[styles.card, styles.warnCard]}>
            <Text style={styles.cardTitle}>Cholesterol Warnings</Text>
            {a.warnings.map((w, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bullet, { color: '#FF8C00' }]}>●</Text>
                <Text style={styles.warnText}>{w}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Benefits */}
        {a?.benefits?.length > 0 && (
          <View style={[styles.card, styles.benefitCard]}>
            <Text style={styles.cardTitle}>Benefits</Text>
            {a.benefits.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bullet, { color: '#00C48C' }]}>●</Text>
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendation */}
        {a?.recommendation && (
          <View style={[styles.card, styles.recCard]}>
            <Text style={styles.cardTitle}>Recommendation</Text>
            <Text style={styles.recText}>{a.recommendation}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2FF' },
  image: { width: '100%', height: 260 },
  content: { padding: 16 },

  canEatCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1.5,
  },
  canEatDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  canEatLabel: { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  canEatAdvice: { fontSize: 13, color: '#555', lineHeight: 18 },

  headerCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12,
    shadowColor: '#6C63FF', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
  },
  foods: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  serving: { fontSize: 13, color: '#9CA3AF' },
  time: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12,
    shadowColor: '#6C63FF', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A2E', marginBottom: 12 },

  warnCard: { backgroundColor: '#FFF8EC', borderLeftWidth: 3, borderLeftColor: '#FF8C00' },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bullet: { fontSize: 10, marginTop: 4 },
  warnText: { fontSize: 13, color: '#7C4A00', flex: 1, lineHeight: 18 },

  benefitCard: { backgroundColor: '#E6FBF5', borderLeftWidth: 3, borderLeftColor: '#00C48C' },
  benefitText: { fontSize: 13, color: '#005A3C', flex: 1, lineHeight: 18 },

  recCard: { backgroundColor: '#EEF0FF', borderLeftWidth: 3, borderLeftColor: '#6C63FF' },
  recText: { fontSize: 14, color: '#3730A3', lineHeight: 21 },
});
