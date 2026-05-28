import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const CONFIG = {
  HIGH:   { color: '#FF453A', bg: '#FF453A18', label: 'HIGH' },
  MEDIUM: { color: '#FF9F0A', bg: '#FF9F0A18', label: 'MED' },
  LOW:    { color: '#30D158', bg: '#30D15818', label: 'LOW' },
};

export default function RiskBadge({ level, score }) {
  const c = CONFIG[level] || CONFIG.MEDIUM;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.color }]}>{c.label}</Text>
      {score != null && (
        <Text style={[styles.score, { color: c.color }]}>{score}/10</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  score: { fontSize: 14, fontWeight: '700', marginTop: 1 },
});
