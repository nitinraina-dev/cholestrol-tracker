import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Switch, Alert, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getLatestReport } from '../services/reportStorage';
import { setTestReminder, getTestReminder, clearTestReminder } from '../services/reminderStorage';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Framingham ATP III 10-year CVD risk calculator ──────────────────────────

function calcFraminghamRisk(age, gender, tc, hdl, sbp, treated, smoker) {
  const male = gender === 'male';
  let pts = 0;

  // Age
  const ageRows = male
    ? [[-99,34,-9],[35,39,-4],[40,44,0],[45,49,3],[50,54,6],[55,59,8],[60,64,10],[65,69,11],[70,74,12],[75,999,13]]
    : [[-99,34,-7],[35,39,-3],[40,44,0],[45,49,3],[50,54,6],[55,59,8],[60,64,10],[65,69,12],[70,74,14],[75,999,16]];
  for (const [lo, hi, p] of ageRows) {
    if (age >= lo && age <= hi) { pts += p; break; }
  }

  // TC by age group
  const gi = age <= 39 ? 0 : age <= 49 ? 1 : age <= 59 ? 2 : age <= 69 ? 3 : 4;
  const tcTbl = male
    ? [[0,4,7,9,11],[0,3,5,6,8],[0,2,3,4,5],[0,1,1,2,3],[0,0,0,1,1]]
    : [[0,4,8,11,13],[0,3,6,8,10],[0,2,4,5,7],[0,1,2,3,4],[0,1,1,2,2]];
  const tcCol = tc < 160 ? 0 : tc < 200 ? 1 : tc < 240 ? 2 : tc < 280 ? 3 : 4;
  pts += tcTbl[gi][tcCol];

  // Smoker
  if (smoker) {
    const smkTbl = male ? [8,5,3,1,1] : [9,7,4,2,1];
    pts += smkTbl[gi];
  }

  // HDL
  pts += hdl >= 60 ? -1 : hdl >= 50 ? 0 : hdl >= 40 ? 1 : 2;

  // Systolic BP
  const sbpIdx = sbp < 120 ? 0 : sbp < 130 ? 1 : sbp < 140 ? 2 : sbp < 160 ? 3 : 4;
  if (male) {
    pts += (treated ? [0,1,2,2,3] : [0,0,1,1,2])[sbpIdx];
  } else {
    pts += (treated ? [0,3,4,5,6] : [0,1,2,3,4])[sbpIdx];
  }

  // Points → risk %
  let pct;
  if (male) {
    const tbl = [1,1,1,1,1,2,2,3,4,5,6,8,10,12,16,20,25];
    pct = pts < 0 ? '<1' : pts >= 17 ? '≥30' : tbl[pts].toString();
  } else {
    const tbl = { 9:1,10:1,11:1,12:1,13:2,14:2,15:3,16:4,17:5,18:6,19:8,20:11,21:14,22:17,23:22,24:27 };
    pct = pts < 9 ? '<1' : pts >= 25 ? '≥30' : tbl[pts].toString();
  }

  const n = parseInt(pct) || 0;
  const level = pct === '<1' ? 'Very Low' : n < 5 ? 'Low' : n < 10 ? 'Moderate' : n < 20 ? 'High' : 'Very High';
  const color = pct === '<1' || n < 5 ? '#00C48C' : n < 10 ? '#FF9F0A' : '#FF4757';
  return { pct, level, color };
}

// ── Education content ────────────────────────────────────────────────────────

const EDU_CARDS = [
  { abbrev: 'LDL', color: '#FF4757', title: 'What is LDL?', body: 'LDL (Low-Density Lipoprotein) is the "bad" cholesterol. It deposits waxy plaque inside artery walls, narrowing them over time and raising heart attack risk.', target: 'Target: < 100 mg/dL\nHigh-risk patients: < 70 mg/dL' },
  { abbrev: 'HDL', color: '#00C48C', title: 'What is HDL?', body: 'HDL (High-Density Lipoprotein) is the "good" cholesterol. It scavenges LDL from the blood and brings it back to the liver to be broken down and removed.', target: 'Target: > 60 mg/dL\nBelow 40 mg/dL is a risk factor' },
  { abbrev: 'TG', color: '#FF8C00', title: 'VLDL & Triglycerides', body: 'VLDL carries triglycerides from the liver to cells. After delivery it becomes LDL. High sugar intake, refined carbs, and alcohol raise both VLDL and TG the most.', target: 'VLDL target: < 30 mg/dL\nTG target: < 150 mg/dL' },
  { abbrev: 'FBR', color: '#30D158', title: 'Fiber Lowers LDL', body: 'Soluble fiber (oats, rajma, psyllium, flaxseed) binds cholesterol in the gut and carries it out before absorption. 5–10g soluble fiber daily lowers LDL by 5–11%.', target: 'Daily fiber goal: 25g+\nSoluble fiber goal: 5–10g' },
  { abbrev: 'EXR', color: '#6C63FF', title: 'Exercise & Cholesterol', body: '150 min of moderate cardio per week raises HDL by 5–10% over 2 months and lowers triglycerides. Walking, cycling, and swimming all count equally.', target: 'Goal: 30 min/day, 5 days a week\nEffect visible in 8–12 weeks' },
  { abbrev: 'LAB', color: '#3B82F6', title: 'Reading Your Lab Report', body: 'A standard lipid panel tests TC, LDL, HDL, VLDL, and TG. Always fast for 12 hours before the test — even a small meal can raise TG by 20–30%, distorting your LDL calculation.', target: 'Fast: 12 hours minimum\nWater: allowed before test' },
];

const PORTIONS = [
  { food: 'Walnuts',          portion: '28g (1 handful)',    note: 'Daily — omega-3 rich' },
  { food: 'Almonds',          portion: '23 nuts (28g)',      note: 'Daily — lowers LDL' },
  { food: 'Olive oil',        portion: '2 tsp per meal',     note: 'For cooking, not excess' },
  { food: 'Oats',             portion: '½ cup dry (40g)',    note: 'Daily — beta-glucan lowers LDL' },
  { food: 'Whole eggs',       portion: '1 per day max',      note: 'Egg whites: unlimited' },
  { food: 'Fish (rohu/salmon)', portion: '85g (1 palm)',     note: '2–3 times per week' },
  { food: 'Avocado',          portion: '½ medium',           note: 'Healthy monounsaturated fat' },
  { food: 'Flaxseed (ground)', portion: '1–2 tbsp daily',   note: 'Mix in curd or roti dough' },
  { food: 'Low-fat curd',     portion: '1 cup (150g)',       note: 'Prefer over full-fat' },
  { food: 'Rajma / Chana',    portion: '½ cup cooked',       note: 'Daily — soluble fiber' },
  { food: 'Dark chocolate',   portion: '30g (2 squares)',    note: '70%+ cocoa only, occasional' },
  { food: 'Green tea',        portion: '2–3 cups/day',       note: 'Catechins mildly lower LDL' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ text }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function ToggleRow({ label, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E5E5EA', true: '#6C63FF' }}
        thumbColor="#fff"
      />
    </View>
  );
}

function GenderToggle({ value, onChange }) {
  return (
    <View style={styles.genderToggle}>
      {['male', 'female'].map(g => (
        <TouchableOpacity
          key={g}
          style={[styles.genderBtn, value === g && styles.genderBtnActive]}
          onPress={() => onChange(g)}
          activeOpacity={0.7}
        >
          <Text style={[styles.genderBtnText, value === g && styles.genderBtnTextActive]}>
            {g === 'male' ? 'Male' : 'Female'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CalcInput({ label, value, onChange, placeholder, unit }) {
  return (
    <View style={styles.calcRow}>
      <Text style={styles.calcLabel}>{label}</Text>
      <View style={styles.calcInputWrap}>
        <TextInput
          style={styles.calcInput}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={placeholder || '0'}
          placeholderTextColor="#C5C6D0"
        />
        {unit ? <Text style={styles.calcUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function ToolsScreen() {
  const eduScrollRef = useRef(null);

  // Framingham state
  const [cvdAge, setCvdAge] = useState('');
  const [cvdGender, setCvdGender] = useState('male');
  const [cvdTC, setCvdTC] = useState('');
  const [cvdHDL, setCvdHDL] = useState('');
  const [cvdSBP, setCvdSBP] = useState('');
  const [cvdTreated, setCvdTreated] = useState(false);
  const [cvdSmoker, setCvdSmoker] = useState(false);
  const [cvdResult, setCvdResult] = useState(null);

  // Friedewald state
  const [fTC, setFTC] = useState('');
  const [fHDL, setFHDL] = useState('');
  const [fTG, setFTG] = useState('');

  // Reminder state
  const [reminderDate, setReminderDate] = useState('');
  const [savedReminder, setSavedReminder] = useState(null);

  // Portion guide expand
  const [portionsExpanded, setPortionsExpanded] = useState(false);

  const loadData = useCallback(async () => {
    const [report, reminder] = await Promise.all([getLatestReport(), getTestReminder()]);
    if (report) {
      if (report.totalCholesterol) setCvdTC(report.totalCholesterol.toString());
      if (report.hdl) setCvdHDL(report.hdl.toString());
      if (report.totalCholesterol) setFTC(report.totalCholesterol.toString());
      if (report.hdl) setFHDL(report.hdl.toString());
      if (report.triglycerides) setFTG(report.triglycerides.toString());
    }
    setSavedReminder(reminder);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Framingham
  const calcCVD = () => {
    const age = parseInt(cvdAge);
    const tc = parseFloat(cvdTC);
    const hdl = parseFloat(cvdHDL);
    const sbp = parseFloat(cvdSBP);
    if (!age || !tc || !hdl || !sbp) {
      Alert.alert('Fill all fields', 'Age, Total Cholesterol, HDL, and Systolic BP are required.');
      return;
    }
    if (age < 20 || age > 79) {
      Alert.alert('Age out of range', 'This calculator is valid for ages 20–79.');
      return;
    }
    setCvdResult(calcFraminghamRisk(age, cvdGender, tc, hdl, sbp, cvdTreated, cvdSmoker));
  };

  // Friedewald LDL
  const tc = parseFloat(fTC) || 0;
  const hdl = parseFloat(fHDL) || 0;
  const tg = parseFloat(fTG) || 0;
  const ldlCalc = tc > 0 && hdl > 0 && tg > 0
    ? tg >= 400 ? null : Math.round(tc - hdl - tg / 5)
    : null;

  // Test reminder
  const saveReminder = async () => {
    if (!reminderDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Invalid date', 'Enter date as YYYY-MM-DD');
      return;
    }
    await setTestReminder(reminderDate);
    setSavedReminder(reminderDate);
    setReminderDate('');
  };

  const deleteReminder = async () => {
    await clearTestReminder();
    setSavedReminder(null);
  };

  // Reminder countdown
  let daysUntil = null;
  let reminderStatus = null;
  if (savedReminder) {
    const testDate = new Date(savedReminder);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    daysUntil = Math.round((testDate - today) / 86400000);
    if (daysUntil < 0) reminderStatus = 'past';
    else if (daysUntil === 0) reminderStatus = 'today';
    else if (daysUntil === 1) reminderStatus = 'tomorrow';
    else reminderStatus = 'future';
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

      {/* ── CVD Risk Calculator ── */}
      <SectionLabel text="CALCULATORS" />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: '#FF475718' }]}>
            <Text style={[styles.cardIconText, { color: '#FF4757' }]}>CVD</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>10-Year Heart Risk</Text>
            <Text style={styles.cardSub}>Framingham ATP III calculator</Text>
          </View>
        </View>

        <GenderToggle value={cvdGender} onChange={setCvdGender} />
        <CalcInput label="Age" value={cvdAge} onChange={setCvdAge} placeholder="e.g. 45" unit="yrs" />
        <CalcInput label="Total Cholesterol" value={cvdTC} onChange={setCvdTC} placeholder="e.g. 210" unit="mg/dL" />
        <CalcInput label="HDL Cholesterol" value={cvdHDL} onChange={setCvdHDL} placeholder="e.g. 45" unit="mg/dL" />
        <CalcInput label="Systolic BP" value={cvdSBP} onChange={setCvdSBP} placeholder="e.g. 130" unit="mmHg" />
        <ToggleRow label="On blood pressure medication" value={cvdTreated} onValueChange={setCvdTreated} />
        <ToggleRow label="Current smoker" value={cvdSmoker} onValueChange={setCvdSmoker} />

        <TouchableOpacity style={styles.calcBtn} onPress={calcCVD} activeOpacity={0.85}>
          <Text style={styles.calcBtnText}>Calculate Risk</Text>
        </TouchableOpacity>

        {cvdResult && (
          <View style={[styles.resultCard, { backgroundColor: cvdResult.color + '12', borderColor: cvdResult.color + '40' }]}>
            <Text style={[styles.resultPct, { color: cvdResult.color }]}>{cvdResult.pct}%</Text>
            <Text style={[styles.resultLevel, { color: cvdResult.color }]}>{cvdResult.level} Risk</Text>
            <Text style={styles.resultNote}>10-year probability of a cardiovascular event</Text>
          </View>
        )}

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>This calculator is for informational use only. Always consult your doctor for medical decisions.</Text>
        </View>
      </View>

      {/* ── LDL Calculator ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: '#6C63FF18' }]}>
            <Text style={[styles.cardIconText, { color: '#6C63FF' }]}>LDL</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>LDL Calculator</Text>
            <Text style={styles.cardSub}>Friedewald formula (TG &lt; 400)</Text>
          </View>
        </View>

        <CalcInput label="Total Cholesterol" value={fTC} onChange={setFTC} placeholder="e.g. 210" unit="mg/dL" />
        <CalcInput label="HDL" value={fHDL} onChange={setFHDL} placeholder="e.g. 45" unit="mg/dL" />
        <CalcInput label="Triglycerides" value={fTG} onChange={setFTG} placeholder="e.g. 180" unit="mg/dL" />

        {ldlCalc !== null ? (
          <View style={[styles.ldlResult, { backgroundColor: ldlCalc < 100 ? '#00C48C18' : ldlCalc < 130 ? '#FF9F0A18' : '#FF475718' }]}>
            <Text style={styles.ldlResultLabel}>Calculated LDL</Text>
            <Text style={[styles.ldlResultVal, { color: ldlCalc < 100 ? '#00C48C' : ldlCalc < 130 ? '#FF9F0A' : '#FF4757' }]}>
              {ldlCalc} mg/dL
            </Text>
            <Text style={styles.ldlFormula}>TC − HDL − (TG ÷ 5)</Text>
          </View>
        ) : (tg >= 400 && tc > 0) ? (
          <View style={styles.ldlInvalid}>
            <Text style={styles.ldlInvalidText}>Friedewald formula is not valid when TG ≥ 400 mg/dL. Use the direct LDL value from your lab report.</Text>
          </View>
        ) : null}
      </View>

      {/* ── Blood Test Reminder ── */}
      <SectionLabel text="TOOLS" />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: '#3B82F618' }]}>
            <Text style={[styles.cardIconText, { color: '#3B82F6' }]}>TST</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Blood Test Reminder</Text>
            <Text style={styles.cardSub}>Never forget to fast before your lipid panel</Text>
          </View>
        </View>

        {savedReminder ? (
          <View style={styles.reminderActive}>
            {reminderStatus === 'today' ? (
              <View style={[styles.reminderBanner, { backgroundColor: '#FF475718', borderColor: '#FF475740' }]}>
                <Text style={[styles.reminderBannerTitle, { color: '#FF4757' }]}>Test is TODAY</Text>
                <Text style={styles.reminderBannerSub}>Fast for 12 hours before your appointment. Water is allowed.</Text>
              </View>
            ) : reminderStatus === 'tomorrow' ? (
              <View style={[styles.reminderBanner, { backgroundColor: '#FF9F0A18', borderColor: '#FF9F0A40' }]}>
                <Text style={[styles.reminderBannerTitle, { color: '#FF9F0A' }]}>Test is TOMORROW</Text>
                <Text style={styles.reminderBannerSub}>Stop eating 12 hours before your scheduled time. Water is fine.</Text>
              </View>
            ) : reminderStatus === 'past' ? (
              <View style={[styles.reminderBanner, { backgroundColor: '#9CA3AF18', borderColor: '#9CA3AF40' }]}>
                <Text style={[styles.reminderBannerTitle, { color: '#9CA3AF' }]}>Test date has passed</Text>
                <Text style={styles.reminderBannerSub}>{savedReminder}</Text>
              </View>
            ) : (
              <View style={[styles.reminderBanner, { backgroundColor: '#6C63FF18', borderColor: '#6C63FF40' }]}>
                <Text style={[styles.reminderBannerTitle, { color: '#6C63FF' }]}>{daysUntil} days until your test</Text>
                <Text style={styles.reminderBannerSub}>{savedReminder} — Remember to fast 12 hours before</Text>
              </View>
            )}
            <TouchableOpacity style={styles.clearReminderBtn} onPress={deleteReminder}>
              <Text style={styles.clearReminderText}>Clear Reminder</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.reminderHintBox}>
              <View style={styles.reminderHintDot} />
              <Text style={styles.reminderHint}>Fasting for 12 hours ensures accurate LDL and TG values. Even a small snack can raise TG by 20–30%.</Text>
            </View>
            <View style={styles.reminderInputRow}>
              <TextInput
                style={styles.reminderInput}
                placeholder="Test date (YYYY-MM-DD)"
                placeholderTextColor="#C5C6D0"
                value={reminderDate}
                onChangeText={setReminderDate}
              />
              <TouchableOpacity style={styles.setReminderBtn} onPress={saveReminder} activeOpacity={0.8}>
                <Text style={styles.setReminderText}>Set</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ── Portion Guide ── */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setPortionsExpanded(p => !p)}
          activeOpacity={0.7}
        >
          <View style={[styles.cardIcon, { backgroundColor: '#00C48C18' }]}>
            <Text style={[styles.cardIconText, { color: '#00C48C' }]}>PRN</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Portion Guide</Text>
            <Text style={styles.cardSub}>Safe amounts for heart-healthy eating</Text>
          </View>
          <View style={[styles.chevron, portionsExpanded && styles.chevronDown]}>
            <View style={styles.chevronArrow} />
          </View>
        </TouchableOpacity>

        {portionsExpanded && (
          <View style={styles.portionList}>
            {PORTIONS.map((p, i) => (
              <View key={i} style={[styles.portionRow, i < PORTIONS.length - 1 && styles.portionRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.portionFood}>{p.food}</Text>
                  <Text style={styles.portionNote}>{p.note}</Text>
                </View>
                <View style={styles.portionTag}>
                  <Text style={styles.portionTagText}>{p.portion}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Education Cards ── */}
      <SectionLabel text="LEARN" />

      <ScrollView
        ref={eduScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_W - 48}
        decelerationRate="fast"
        contentContainerStyle={styles.eduScroll}
        pagingEnabled={false}
      >
        {EDU_CARDS.map((card, i) => (
          <View key={i} style={[styles.eduCard, { width: SCREEN_W - 64 }]}>
            <View style={[styles.eduIconBox, { backgroundColor: card.color + '18' }]}>
              <Text style={[styles.eduIconText, { color: card.color }]}>{card.abbrev}</Text>
            </View>
            <Text style={styles.eduTitle}>{card.title}</Text>
            <Text style={styles.eduBody}>{card.body}</Text>
            <View style={[styles.eduTargetBox, { borderLeftColor: card.color }]}>
              <Text style={[styles.eduTarget, { color: card.color }]}>{card.target}</Text>
            </View>
            <Text style={styles.eduCounter}>{i + 1} / {EDU_CARDS.length}</Text>
          </View>
        ))}
      </ScrollView>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2FF' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 18,
    shadowColor: '#6C63FF', shadowOpacity: 0.07, shadowRadius: 12, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardIconText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  cardSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Gender toggle
  genderToggle: { flexDirection: 'row', backgroundColor: '#F0F2FF', borderRadius: 12, padding: 4, marginBottom: 12 },
  genderBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  genderBtnActive: { backgroundColor: '#6C63FF' },
  genderBtnText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  genderBtnTextActive: { color: '#fff' },

  // Calc inputs
  calcRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#F0F2FF' },
  calcLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  calcInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calcInput: { width: 80, backgroundColor: '#F8F8FC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: '700', color: '#1A1A2E', textAlign: 'right', borderWidth: 1.5, borderColor: '#E5E5EA' },
  calcUnit: { fontSize: 11, color: '#9CA3AF', width: 46 },

  // Toggle row
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#F0F2FF' },
  toggleLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1A1A2E' },

  calcBtn: { backgroundColor: '#6C63FF', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 16, shadowColor: '#6C63FF', shadowOpacity: 0.3, shadowRadius: 10, elevation: 3 },
  calcBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  resultCard: { borderRadius: 16, padding: 20, alignItems: 'center', marginTop: 14, borderWidth: 1.5 },
  resultPct: { fontSize: 44, fontWeight: '900', lineHeight: 50 },
  resultLevel: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  resultNote: { fontSize: 12, color: '#9CA3AF', marginTop: 6, textAlign: 'center' },

  disclaimerBox: { backgroundColor: '#F8F8FC', borderRadius: 12, padding: 12, marginTop: 14 },
  disclaimerText: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16 },

  // LDL calc
  ldlResult: { borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 14 },
  ldlResultLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  ldlResultVal: { fontSize: 36, fontWeight: '900', marginTop: 4 },
  ldlFormula: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  ldlInvalid: { backgroundColor: '#FFF8EC', borderRadius: 12, padding: 14, marginTop: 14 },
  ldlInvalidText: { fontSize: 13, color: '#7C4A00', lineHeight: 18 },

  // Reminder
  reminderActive: { gap: 12 },
  reminderBanner: { borderRadius: 14, padding: 16, borderWidth: 1.5 },
  reminderBannerTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  reminderBannerSub: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  clearReminderBtn: { backgroundColor: '#FFF0F1', borderRadius: 12, padding: 12, alignItems: 'center' },
  clearReminderText: { fontSize: 14, color: '#FF4757', fontWeight: '700' },
  reminderHintBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EEF0FF', borderRadius: 12, padding: 12, marginBottom: 12 },
  reminderHintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6C63FF', marginTop: 4 },
  reminderHint: { flex: 1, fontSize: 13, color: '#3730A3', lineHeight: 18 },
  reminderInputRow: { flexDirection: 'row', gap: 10 },
  reminderInput: { flex: 1, backgroundColor: '#F8F8FC', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A1A2E', borderWidth: 1.5, borderColor: '#E5E5EA' },
  setReminderBtn: { backgroundColor: '#6C63FF', borderRadius: 14, paddingHorizontal: 20, justifyContent: 'center' },
  setReminderText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Portion guide
  chevron: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  chevronArrow: { width: 7, height: 7, borderRightWidth: 2, borderTopWidth: 2, borderColor: '#C7C7CC', transform: [{ rotate: '45deg' }] },
  chevronDown: { transform: [{ rotate: '90deg' }] },
  portionList: { marginTop: 4 },
  portionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  portionRowBorder: { borderTopWidth: 0.5, borderTopColor: '#F0F2FF' },
  portionFood: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  portionNote: { fontSize: 12, color: '#9CA3AF' },
  portionTag: { backgroundColor: '#EEF0FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  portionTagText: { fontSize: 12, color: '#6C63FF', fontWeight: '700' },

  // Education cards
  eduScroll: { paddingLeft: 16, paddingRight: 16, gap: 12 },
  eduCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    shadowColor: '#6C63FF', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
    marginBottom: 16,
  },
  eduIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  eduIconText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  eduTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 10 },
  eduBody: { fontSize: 14, color: '#4B5563', lineHeight: 21, marginBottom: 14 },
  eduTargetBox: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 14 },
  eduTarget: { fontSize: 13, fontWeight: '700', lineHeight: 20 },
  eduCounter: { fontSize: 11, color: '#C5C6D0', textAlign: 'right' },
});
