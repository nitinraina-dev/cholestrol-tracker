import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const NUTRIENTS = {
  saturatedFat: { limit: 20,  label: 'Saturated Fat', unit: 'g',  badHigh: true },
  transFat:     { limit: 2,   label: 'Trans Fat',      unit: 'g',  badHigh: true },
  cholesterol:  { limit: 200, label: 'Cholesterol',    unit: 'mg', badHigh: true },
  sugar:        { limit: 25,  label: 'Sugar',           unit: 'g',  badHigh: true },
  fiber:        { limit: 25,  label: 'Fiber',           unit: 'g',  badHigh: false },
  omega3:       { limit: 2,   label: 'Omega-3',         unit: 'g',  badHigh: false },
  protein:      { limit: 50,  label: 'Protein',         unit: 'g',  badHigh: false },
};

export default function NutrientRow({ name, value }) {
  const cfg = NUTRIENTS[name];
  if (!cfg) return null;

  const pct = Math.min((value / cfg.limit) * 100, 100);
  const barColor = cfg.badHigh
    ? pct > 75 ? '#FF453A' : pct > 40 ? '#FF9F0A' : '#30D158'
    : pct > 60 ? '#30D158' : pct > 30 ? '#FF9F0A' : '#AEAEB2';

  const display = value % 1 === 0 ? `${value}` : value.toFixed(1);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{cfg.label}</Text>
      <View style={styles.barWrap}>
        <View style={[styles.bar, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.value, { color: barColor }]}>{display}{cfg.unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 12 },
  label: { width: 104, fontSize: 14, color: '#3C3C43', fontWeight: '500' },
  barWrap: { flex: 1, height: 4, backgroundColor: '#F2F2F7', borderRadius: 2, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2 },
  value: { width: 52, fontSize: 13, fontWeight: '700', textAlign: 'right' },
});
