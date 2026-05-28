import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoFull } from '../components/Logo';

const MENU_ITEMS = [
  { abbrev: 'RX', color: '#6C63FF', title: 'Blood Reports',        desc: 'Upload and track your cholesterol reports', screen: 'Reports' },
  { abbrev: 'AI', color: '#00C48C', title: 'Meal Suggestions',     desc: 'AI-suggested safe meals for you',           screen: 'Suggestions' },
  { abbrev: 'OK', color: '#30D158', title: 'Safe Foods',            desc: 'Foods you scanned with low risk',          screen: 'SafeFoods' },
  { abbrev: 'TX', color: '#FF8C00', title: 'Tools & Calculators',  desc: 'CVD risk, LDL formula, test reminder',      screen: 'Tools' },
  { abbrev: 'DR', color: '#3B82F6', title: 'Doctor Notes',          desc: 'Notes from your appointments',             screen: 'DoctorNotes' },
  { abbrev: 'SG', color: '#8E8E93', title: 'Settings',              desc: 'Diet preference, water goal and more',     screen: 'Settings' },
];

export default function MoreScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <LogoFull iconSize={32} light />
        <Text style={styles.heroSub}>All your tools in one place</Text>
      </View>

      <View style={styles.list}>
        {MENU_ITEMS.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.6}
          >
            <View style={[styles.iconBox, { backgroundColor: item.color + '18' }]}>
              <Text style={[styles.iconAbbrev, { color: item.color }]}>{item.abbrev}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.desc}>{item.desc}</Text>
            </View>
            <View style={styles.chevronBox}>
              <View style={styles.chevronArrow} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.versionBox}>
        <Text style={styles.versionText}>Cholesterol Tracker v3.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  hero: { backgroundColor: '#0A0A14', paddingHorizontal: 24, paddingBottom: 32 },
  heroSub: { fontSize: 14, color: '#636366', marginTop: 10 },

  list: {
    backgroundColor: '#fff', borderRadius: 18,
    marginHorizontal: 16, marginTop: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 18,
  },
  menuItemBorder: { borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA' },
  iconBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconAbbrev: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  title: { fontSize: 15, fontWeight: '700', color: '#000' },
  desc: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  chevronBox: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  chevronArrow: { width: 7, height: 7, borderRightWidth: 2, borderTopWidth: 2, borderColor: '#C7C7CC', transform: [{ rotate: '45deg' }] },

  versionBox: { alignItems: 'center', marginTop: 28 },
  versionText: { fontSize: 12, color: '#C7C7CC', fontWeight: '500' },
});
