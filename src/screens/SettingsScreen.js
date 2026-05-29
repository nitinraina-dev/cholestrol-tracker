import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Switch, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getDietPreference, setDietPreference, getWaterGoal, setWaterGoal, DIET_OPTIONS,
  getLanguagePreference, setLanguagePreference, LANGUAGE_OPTIONS,
} from '../services/settingsStorage';
import { resetTour } from '../services/tourStorage';
import { useTour } from '../contexts/TourContext';
import {
  getNotificationPrefs, saveNotificationPrefs,
  requestNotificationPermission,
  scheduleWaterReminders, cancelWaterReminders,
  scheduleMealReminders, cancelMealReminders,
} from '../services/notificationService';

export default function SettingsScreen() {
  const [diet, setDiet] = useState('omnivore');
  const [waterGoal, setWaterGoalState] = useState('2.5');
  const [language, setLanguageState] = useState('english');
  const [notifPrefs, setNotifPrefs] = useState({ waterReminders: false, waterInterval: 2, mealReminders: false, mealTimes: ['08:00', '13:00', '19:30'] });
  const { startTour } = useTour();

  const load = useCallback(async () => {
    const [d, w, l, np] = await Promise.all([getDietPreference(), getWaterGoal(), getLanguagePreference(), getNotificationPrefs()]);
    setDiet(d);
    setWaterGoalState(w.toString());
    setLanguageState(l);
    setNotifPrefs(np);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDietChange = async (key) => {
    setDiet(key);
    await setDietPreference(key);
  };

  const handleLanguageChange = async (key) => {
    setLanguageState(key);
    await setLanguagePreference(key);
  };

  const handleWaterToggle = async (enabled) => {
    const granted = enabled ? await requestNotificationPermission() : true;
    if (enabled && !granted) { Alert.alert('Permission denied', 'Enable notifications in your device settings to use reminders.'); return; }
    const updated = { ...notifPrefs, waterReminders: enabled };
    setNotifPrefs(updated);
    await saveNotificationPrefs(updated);
    if (enabled) await scheduleWaterReminders(updated.waterInterval);
    else await cancelWaterReminders();
  };

  const handleMealToggle = async (enabled) => {
    const granted = enabled ? await requestNotificationPermission() : true;
    if (enabled && !granted) { Alert.alert('Permission denied', 'Enable notifications in your device settings to use reminders.'); return; }
    const updated = { ...notifPrefs, mealReminders: enabled };
    setNotifPrefs(updated);
    await saveNotificationPrefs(updated);
    if (enabled) await scheduleMealReminders(updated.mealTimes);
    else await cancelMealReminders();
  };

  const handleWaterGoalSave = async () => {
    const val = parseFloat(waterGoal);
    if (isNaN(val) || val < 0.5 || val > 6) {
      Alert.alert('Enter a value between 0.5 and 6 litres');
      return;
    }
    await setWaterGoal(val);
    Alert.alert('Saved', 'Water goal updated');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Diet Preference */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diet Preference</Text>
        <Text style={styles.sectionSub}>Affects food analysis and meal suggestions</Text>
        {DIET_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.optionRow, diet === opt.key && styles.optionRowActive]}
            onPress={() => handleDietChange(opt.key)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, diet === opt.key && styles.optionLabelActive]}>{opt.label}</Text>
              <Text style={styles.optionDesc}>{opt.desc}</Text>
            </View>
            <View style={[styles.radio, diet === opt.key && styles.radioActive]}>
              {diet === opt.key && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Output Language</Text>
        <Text style={styles.sectionSub}>Language used for AI analysis, suggestions and advice</Text>
        <View style={styles.langGrid}>
          {LANGUAGE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.langChip, language === opt.key && styles.langChipActive]}
              onPress={() => handleLanguageChange(opt.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.langLabel, language === opt.key && styles.langLabelActive]}>
                {opt.label}
              </Text>
              <Text style={[styles.langNative, language === opt.key && styles.langNativeActive]}>
                {opt.native}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Water Goal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Water Goal</Text>
        <Text style={styles.sectionSub}>How much water do you aim to drink daily?</Text>
        <View style={styles.waterRow}>
          <TextInput
            style={styles.waterInput}
            value={waterGoal}
            onChangeText={setWaterGoalState}
            keyboardType="numeric"
            placeholder="2.5"
            placeholderTextColor="#C5C6D0"
          />
          <Text style={styles.waterUnit}>Litres</Text>
          <TouchableOpacity style={styles.saveBtn} onPress={handleWaterGoalSave}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.waterPresets}>
          {[1.5, 2, 2.5, 3].map(v => (
            <TouchableOpacity key={v} style={styles.preset} onPress={() => setWaterGoalState(v.toString())}>
              <Text style={styles.presetText}>{v}L</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reminders</Text>
        <Text style={styles.sectionSub}>Get nudges to stay on track with your cholesterol goals</Text>

        <View style={styles.notifRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifLabel}>Water Reminders</Text>
            <Text style={styles.notifDesc}>Every {notifPrefs.waterInterval}h from 8 AM to 10 PM</Text>
          </View>
          <Switch
            value={notifPrefs.waterReminders}
            onValueChange={handleWaterToggle}
            trackColor={{ false: '#E5E5EA', true: '#6C63FF' }}
            thumbColor="#fff"
          />
        </View>
        {notifPrefs.waterReminders && (
          <View style={styles.intervalRow}>
            <Text style={styles.intervalLabel}>Interval:</Text>
            {[1, 2, 3, 4].map(h => (
              <TouchableOpacity
                key={h}
                style={[styles.intervalChip, notifPrefs.waterInterval === h && styles.intervalChipActive]}
                onPress={async () => {
                  const updated = { ...notifPrefs, waterInterval: h };
                  setNotifPrefs(updated);
                  await saveNotificationPrefs(updated);
                  await scheduleWaterReminders(h);
                }}
              >
                <Text style={[styles.intervalChipText, notifPrefs.waterInterval === h && styles.intervalChipTextActive]}>
                  {h}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={[styles.notifRow, { marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifLabel}>Meal Log Reminders</Text>
            <Text style={styles.notifDesc}>At {notifPrefs.mealTimes?.join(', ')} daily</Text>
          </View>
          <Switch
            value={notifPrefs.mealReminders}
            onValueChange={handleMealToggle}
            trackColor={{ false: '#E5E5EA', true: '#6C63FF' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* App Tour */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Tour</Text>
        <Text style={styles.sectionSub}>Step-by-step guide showing how to use every feature</Text>
        <TouchableOpacity
          style={styles.tourBtn}
          onPress={async () => { await resetTour(); startTour(); }}
          activeOpacity={0.8}
        >
          <View style={styles.tourBtnIcon}>
            <View style={[styles.tourDot, { backgroundColor: '#6C63FF' }]} />
            <View style={[styles.tourDot, { backgroundColor: '#6C63FF88' }]} />
            <View style={[styles.tourDot, { backgroundColor: '#6C63FF44' }]} />
          </View>
          <Text style={styles.tourBtnText}>Start App Tour</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>Cholesterol Tracker</Text>
        <Text style={styles.aboutText}>Personalised cholesterol management using AI. Track meals, monitor blood reports, and get tailored food advice.</Text>
        <Text style={styles.aboutVersion}>Version 3.0 · Personalised AI-powered health tracking</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  section: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 18, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#9CA3AF', marginBottom: 16, lineHeight: 18 },

  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 14, marginBottom: 8,
    backgroundColor: '#F2F2F7', borderWidth: 1.5, borderColor: 'transparent',
  },
  optionRowActive: { backgroundColor: '#EEF0FF', borderColor: '#6C63FF' },
  optionLabel: { fontSize: 15, fontWeight: '700', color: '#2D3748' },
  optionLabelActive: { color: '#6C63FF' },
  optionDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C5C6D0', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#6C63FF' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6C63FF' },

  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: '#F2F2F7', borderWidth: 1.5, borderColor: 'transparent',
    minWidth: '44%', flex: 1,
  },
  langChipActive: { backgroundColor: '#EEF0FF', borderColor: '#6C63FF' },
  langLabel: { fontSize: 13, fontWeight: '700', color: '#2D3748' },
  langLabelActive: { color: '#6C63FF' },
  langNative: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  langNativeActive: { color: '#8B7FF0' },

  waterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  waterInput: {
    flex: 1, backgroundColor: '#F2F2F7', borderRadius: 14, padding: 14,
    fontSize: 18, fontWeight: '800', color: '#1A1A2E', borderWidth: 1.5, borderColor: '#E5E5EA',
  },
  waterUnit: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  saveBtn: { backgroundColor: '#6C63FF', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  waterPresets: { flexDirection: 'row', gap: 10 },
  preset: { flex: 1, backgroundColor: '#EEF0FF', padding: 10, borderRadius: 12, alignItems: 'center' },
  presetText: { fontSize: 13, color: '#6C63FF', fontWeight: '700' },

  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifLabel: { fontSize: 15, fontWeight: '700', color: '#2D3748' },
  notifDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  intervalLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
  intervalChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F2F2F7', borderWidth: 1.5, borderColor: 'transparent' },
  intervalChipActive: { backgroundColor: '#EEF0FF', borderColor: '#6C63FF' },
  intervalChipText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  intervalChipTextActive: { color: '#6C63FF' },

  tourBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#EEF0FF', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#6C63FF33',
  },
  tourBtnIcon: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  tourDot: { width: 8, height: 8, borderRadius: 4 },
  tourBtnText: { fontSize: 15, fontWeight: '700', color: '#6C63FF' },

  aboutCard: { margin: 16, marginTop: 16, backgroundColor: '#0A0A14', borderRadius: 18, padding: 20 },
  aboutTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 8 },
  aboutText: { fontSize: 13, color: '#9CA3AF', lineHeight: 20, marginBottom: 10 },
  aboutVersion: { fontSize: 11, color: '#6B7280' },
});
