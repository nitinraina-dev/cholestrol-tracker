import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMeals } from '../services/storage';
import { getStreakData } from '../services/streakStorage';
import { getEarnedBadges, getAllBadges } from '../services/streakStorage';
import { getReports, getValueStatus, parseReportDate } from '../services/reportStorage';

function getDayColor(avgRisk) {
  if (avgRisk == null) return '#F0F2FF';
  if (avgRisk <= 3) return '#00C48C';
  if (avgRisk <= 6) return '#FF8C00';
  return '#FF4757';
}

function buildCalendar(meals) {
  const map = {};
  meals.forEach(m => {
    const d = new Date(m.timestamp).toDateString();
    if (!map[d]) map[d] = [];
    map[d].push(m.analysis?.riskScore || 0);
  });
  const result = {};
  Object.entries(map).forEach(([d, scores]) => {
    result[d] = scores.reduce((a, b) => a + b, 0) / scores.length;
  });
  return result;
}

function buildFiberCalendar(meals) {
  const map = {};
  meals.forEach(m => {
    const d = new Date(m.timestamp).toDateString();
    map[d] = (map[d] || 0) + (m.analysis?.nutrients?.fiber || 0);
  });
  return map;
}

function buildLast30Days() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push({ dateStr: d.toDateString(), label: d.getDate(), month: d.toLocaleString('en-IN', { month: 'short' }) });
  }
  return days;
}

function FiberCard({ fiberMap }) {
  const today = new Date().toDateString();
  const todayFiber = fiberMap[today] || 0;
  const GOAL = 25;
  const pct = Math.min((todayFiber / GOAL) * 100, 100);
  const barColor = pct >= 100 ? '#00C48C' : pct >= 60 ? '#FF9F0A' : '#9CA3AF';
  const daysHit = Object.values(fiberMap).filter(v => v >= GOAL).length;

  return (
    <View style={styles.card}>
      <View style={styles.fiberHeader}>
        <View>
          <Text style={styles.cardTitle}>Daily Fiber</Text>
          <Text style={styles.cardSub}>25g/day lowers LDL by up to 11%</Text>
        </View>
        <View style={[styles.fiberBadge, { backgroundColor: barColor + '20' }]}>
          <Text style={[styles.fiberBadgeText, { color: barColor }]}>{daysHit} days hit</Text>
        </View>
      </View>
      <View style={styles.fiberBarRow}>
        <View style={styles.fiberBarBg}>
          <View style={[styles.fiberBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[styles.fiberVal, { color: barColor }]}>{todayFiber.toFixed(1)}g / {GOAL}g</Text>
      </View>
      <Text style={styles.fiberHint}>
        {pct >= 100 ? 'Fiber goal reached today!' : `${(GOAL - todayFiber).toFixed(1)}g more to hit today's goal`}
      </Text>
    </View>
  );
}

function ReportMealCorrelation({ reports, meals }) {
  if (reports.length === 0) return null;

  if (reports.length === 1) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Meal-Report Correlation</Text>
        <Text style={styles.cardSub}>How your eating affects your blood results</Text>
        <View style={styles.correlationPlaceholder}>
          <View style={styles.correlationPlaceholderDot} />
          <Text style={styles.correlationPlaceholderText}>
            Add a second blood report after your next test to see how your meals between reports affected your LDL, TG, and HDL.
          </Text>
        </View>
      </View>
    );
  }

  const sorted = [...reports].sort((a, b) => (parseReportDate(a.date) || 0) - (parseReportDate(b.date) || 0));
  const intervals = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const r1 = sorted[i];
    const r2 = sorted[i + 1];
    const d1 = parseReportDate(r1.date);
    const d2 = parseReportDate(r2.date);
    const days = Math.round((d2 - d1) / 86400000);
    const interval_meals = meals.filter(m => {
      const md = new Date(m.timestamp);
      return md >= d1 && md <= d2;
    });
    const avgRisk = interval_meals.length > 0
      ? interval_meals.reduce((s, m) => s + (m.analysis?.riskScore || 0), 0) / interval_meals.length
      : null;
    const avgFiber = interval_meals.length > 0
      ? interval_meals.reduce((s, m) => s + (m.analysis?.nutrients?.fiber || 0), 0) / interval_meals.length
      : null;
    intervals.push({
      from: r1, to: r2, days,
      mealCount: interval_meals.length,
      avgRisk, avgFiber,
      ldlChange: r1.ldl != null && r2.ldl != null ? Math.round(r2.ldl - r1.ldl) : null,
      hdlChange: r1.hdl != null && r2.hdl != null ? Math.round(r2.hdl - r1.hdl) : null,
      tgChange: r1.triglycerides != null && r2.triglycerides != null ? Math.round(r2.triglycerides - r1.triglycerides) : null,
    });
  }
  intervals.reverse();

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Meal-Report Correlation</Text>
      <Text style={styles.cardSub}>How your eating between tests changed your results</Text>
      {intervals.map((iv, i) => {
        const fromDate = parseReportDate(iv.from.date);
        const toDate = parseReportDate(iv.to.date);
        const fromLabel = fromDate ? fromDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : iv.from.date;
        const toLabel = toDate ? toDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : iv.to.date;
        const riskColor = iv.avgRisk == null ? '#9CA3AF' : getDayColor(iv.avgRisk);
        const changes = [
          { label: 'LDL', val: iv.ldlChange, goodDir: 'down' },
          { label: 'HDL', val: iv.hdlChange, goodDir: 'up' },
          { label: 'TG',  val: iv.tgChange,  goodDir: 'down' },
        ].filter(c => c.val !== null);

        return (
          <View key={i} style={[styles.intervalBlock, i > 0 && styles.intervalBlockBorder]}>
            <View style={styles.intervalTopRow}>
              <View style={styles.intervalDotRow}>
                <View style={[styles.iDot, { backgroundColor: '#6C63FF' }]} />
                <View style={styles.iLine} />
                <View style={[styles.iDot, { backgroundColor: '#6C63FF' }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.intervalDates}>{fromLabel} → {toLabel}</Text>
                <Text style={styles.intervalMeta}>{iv.days} days · {iv.mealCount} meals logged</Text>
              </View>
              {iv.avgRisk != null && (
                <View style={[styles.intervalRiskBadge, { backgroundColor: riskColor + '20' }]}>
                  <Text style={[styles.intervalRiskText, { color: riskColor }]}>
                    Avg {iv.avgRisk.toFixed(1)}/10
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.intervalChanges}>
              {changes.map(({ label, val, goodDir }) => {
                const improved = goodDir === 'down' ? val < 0 : val > 0;
                const color = val === 0 ? '#9CA3AF' : improved ? '#00C48C' : '#FF4757';
                return (
                  <View key={label} style={[styles.changeChip, { backgroundColor: color + '14' }]}>
                    <Text style={styles.changeLabel}>{label}</Text>
                    <Text style={[styles.changeVal, { color }]}>{val > 0 ? '+' : ''}{val}</Text>
                  </View>
                );
              })}
              {iv.avgFiber != null && (
                <View style={[styles.changeChip, { backgroundColor: '#00C48C14' }]}>
                  <Text style={styles.changeLabel}>Fiber/meal</Text>
                  <Text style={[styles.changeVal, { color: iv.avgFiber >= 4 ? '#00C48C' : '#FF8C00' }]}>
                    {iv.avgFiber.toFixed(1)}g
                  </Text>
                </View>
              )}
            </View>

            {iv.mealCount === 0 && (
              <Text style={styles.noMealsNote}>No meals were logged in this period</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function WeeklyRiskChart({ calendarMap }) {
  const MAX_BAR_H = 72;
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const dateStr = d.toDateString();
    return {
      dateStr,
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      avgRisk: calendarMap[dateStr] ?? null,
    };
  });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Weekly Risk Trend</Text>
      <Text style={styles.cardSub}>Average cholesterol risk per day</Text>
      <View style={styles.chartRow}>
        {last7.map((day, i) => {
          const color = getDayColor(day.avgRisk);
          const barH = day.avgRisk != null ? Math.max((day.avgRisk / 10) * MAX_BAR_H, 6) : 4;
          const isToday = day.dateStr === new Date().toDateString();
          return (
            <View key={i} style={styles.chartCol}>
              {day.avgRisk != null ? (
                <Text style={[styles.chartVal, { color }]}>{day.avgRisk.toFixed(1)}</Text>
              ) : (
                <Text style={styles.chartValEmpty}>-</Text>
              )}
              <View style={[styles.chartBarArea, { height: MAX_BAR_H }]}>
                <View style={[styles.chartBar, { height: barH, backgroundColor: color, borderRadius: 5 }]} />
              </View>
              <Text style={[styles.chartDayLabel, isToday && styles.chartDayToday]}>
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CholesterolStatusCard({ reports }) {
  if (!reports.length) return null;
  const latest = [...reports].sort((a, b) => (parseReportDate(b.date) || 0) - (parseReportDate(a.date) || 0))[0];

  const items = [
    { key: 'ldl',              abbrev: 'LDL',   val: latest.ldl,              accent: '#FF4757', ideal: '< 100 mg/dL' },
    { key: 'hdl',              abbrev: 'HDL',   val: latest.hdl,              accent: '#00C48C', ideal: '> 60 mg/dL' },
    { key: 'vldl',             abbrev: 'VLDL',  val: latest.vldl,             accent: '#FF8C00', ideal: '< 30 mg/dL' },
    { key: 'triglycerides',    abbrev: 'TG',    val: latest.triglycerides,    accent: '#3B82F6', ideal: '< 150 mg/dL' },
    { key: 'totalCholesterol', abbrev: 'Total', val: latest.totalCholesterol, accent: '#6C63FF', ideal: '< 200 mg/dL' },
  ].filter(item => item.val != null);

  if (!items.length) return null;

  const badCount = items.filter(({ key, val }) => {
    if (key === 'hdl') return val < 40;
    if (key === 'ldl') return val >= 130;
    if (key === 'vldl') return val >= 40;
    if (key === 'triglycerides') return val >= 200;
    if (key === 'totalCholesterol') return val >= 240;
    return false;
  }).length;

  const riskLabel = badCount === 0 ? 'Low Risk' : badCount <= 2 ? 'Moderate Risk' : 'High Risk';
  const riskColor = badCount === 0 ? '#00C48C' : badCount <= 2 ? '#FF8C00' : '#FF4757';
  const latestDate = parseReportDate(latest.date);
  const dateLabel = latestDate ? latestDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : latest.date;
  const maxVals = { ldl: 200, hdl: 100, vldl: 80, triglycerides: 500, totalCholesterol: 320 };

  return (
    <View style={styles.card}>
      <View style={styles.statusHeader}>
        <View>
          <Text style={styles.cardTitle}>Cholesterol Status</Text>
          <Text style={styles.cardSub}>{dateLabel}</Text>
        </View>
        <View style={[styles.riskPill, { backgroundColor: riskColor + '20' }]}>
          <Text style={[styles.riskPillText, { color: riskColor }]}>{riskLabel}</Text>
        </View>
      </View>
      {items.map(({ key, abbrev, val, accent, ideal }) => {
        const status = getValueStatus(key, val);
        const barColor = status.color;
        const maxVal = maxVals[key] || 300;
        const pct = Math.min((val / maxVal) * 100, 100);
        return (
          <View key={key} style={styles.statusRow}>
            <View style={[styles.statusAbbrevBox, { backgroundColor: accent + '18' }]}>
              <Text style={[styles.statusAbbrev, { color: accent }]}>{abbrev}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.statusBarBg}>
                <View style={[styles.statusBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
              </View>
              <Text style={styles.statusIdeal}>{ideal}</Text>
            </View>
            <View style={styles.statusRight}>
              <Text style={[styles.statusVal, { color: barColor }]}>{val}</Text>
              <View style={[styles.statusChip, { backgroundColor: barColor + '20' }]}>
                <Text style={[styles.statusChipText, { color: barColor }]}>{status.label}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ReportTrendCard({ reports }) {
  if (reports.length < 2) return null;
  const sorted = [...reports].sort((a, b) => (parseReportDate(a.date) || 0) - (parseReportDate(b.date) || 0));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];

  const fields = [
    { key: 'ldl', label: 'LDL', good: 'down' },
    { key: 'hdl', label: 'HDL', good: 'up' },
    { key: 'vldl', label: 'VLDL', good: 'down' },
    { key: 'triglycerides', label: 'TG', good: 'down' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Report Comparison</Text>
      <Text style={styles.cardSub}>Latest vs Previous Report</Text>
      {fields.map(({ key, label, good }) => {
        const cur = latest[key];
        const old = prev[key];
        if (cur == null || old == null) return null;
        const diff = cur - old;
        const improved = good === 'down' ? diff < 0 : diff > 0;
        const color = improved ? '#00C48C' : diff === 0 ? '#9CA3AF' : '#FF4757';
        const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
        return (
          <View key={key} style={styles.trendRow}>
            <Text style={styles.trendLabel}>{label}</Text>
            <Text style={styles.trendOld}>{old} mg/dL</Text>
            <Text style={[styles.trendArrow, { color }]}>{arrow}</Text>
            <Text style={[styles.trendNew, { color }]}>{cur} mg/dL</Text>
            <Text style={[styles.trendDiff, { color }]}>({diff > 0 ? '+' : ''}{diff})</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function InsightsScreen() {
  const [calendarMap, setCalendarMap] = useState({});
  const [fiberMap, setFiberMap] = useState({});
  const [allMeals, setAllMeals] = useState([]);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [earnedBadgeIds, setEarnedBadgeIds] = useState([]);
  const [reports, setReports] = useState([]);
  const allBadges = getAllBadges();
  const days = buildLast30Days();

  const load = useCallback(async () => {
    const [meals, streakData, badges, reps] = await Promise.all([
      getMeals(), getStreakData(), getEarnedBadges(), getReports(),
    ]);
    setCalendarMap(buildCalendar(meals));
    setFiberMap(buildFiberCalendar(meals));
    setAllMeals(meals);
    setStreak(streakData);
    setEarnedBadgeIds(badges);
    setReports(reps);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

      {/* Streak Banner */}
      <View style={styles.streakBanner}>
        <View style={styles.streakItem}>
          <Text style={styles.streakNum}>{streak.current}</Text>
          <Text style={styles.streakLabel}>Current Streak</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakItem}>
          <Text style={styles.streakNum}>{streak.best}</Text>
          <Text style={styles.streakLabel}>Best Streak</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakItem}>
          <Text style={styles.streakNum}>{(streak.lowRiskDays || []).length}</Text>
          <Text style={styles.streakLabel}>Green Days</Text>
        </View>
      </View>

      {/* Weekly Risk Chart */}
      <WeeklyRiskChart calendarMap={calendarMap} />

      {/* Fiber Progress */}
      <FiberCard fiberMap={fiberMap} />

      {/* Cholesterol Status */}
      <CholesterolStatusCard reports={reports} />

      {/* Report-Meal Correlation */}
      <ReportMealCorrelation reports={reports} meals={allMeals} />

      {/* 30-Day Calendar */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Last 30 Days</Text>
        <View style={styles.legend}>
          {[{ color: '#00C48C', label: 'Low risk' }, { color: '#FF8C00', label: 'Moderate' }, { color: '#FF4757', label: 'High risk' }, { color: '#F0F2FF', label: 'No data' }].map(l => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendLabel}>{l.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {days.map((day, i) => {
            const avgRisk = calendarMap[day.dateStr];
            const color = getDayColor(avgRisk);
            const isToday = day.dateStr === new Date().toDateString();
            return (
              <View key={i} style={[styles.dayCell, { backgroundColor: color, borderWidth: isToday ? 2 : 0, borderColor: '#6C63FF' }]}>
                <Text style={[styles.dayNum, { color: avgRisk != null ? '#fff' : '#C5C6D0' }]}>{day.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Report Trend */}
      <ReportTrendCard reports={reports} />

      {/* Badges */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Badges</Text>
        <Text style={styles.cardSub}>{earnedBadgeIds.length} / {allBadges.length} earned</Text>
        <View style={styles.badgeGrid}>
          {allBadges.map(badge => {
            const earned = earnedBadgeIds.includes(badge.id);
            const abbrev = badge.title.slice(0, 2).toUpperCase();
            return (
              <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeLocked]}>
                <View style={[styles.badgeIconBox, { backgroundColor: earned ? '#6C63FF' : '#C5C6D0' }]}>
                  <Text style={styles.badgeIconText}>{abbrev}</Text>
                </View>
                <Text style={[styles.badgeTitle, !earned && styles.badgeTextLocked]}>{badge.title}</Text>
                <Text style={[styles.badgeDesc, !earned && styles.badgeTextLocked]}>{badge.desc}</Text>
                {!earned && <Text style={styles.lockedLabel}>Locked</Text>}
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2FF' },

  streakBanner: {
    backgroundColor: '#1A1A2E', margin: 16, borderRadius: 20, padding: 20,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
  },
  streakItem: { alignItems: 'center' },
  streakNum: { fontSize: 32, fontWeight: '900', color: '#fff' },
  streakLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  streakDivider: { width: 1, height: 40, backgroundColor: '#ffffff22' },

  card: {
    backgroundColor: '#fff', margin: 16, marginTop: 0, borderRadius: 20, padding: 18,
    shadowColor: '#6C63FF', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  cardSub: { fontSize: 12, color: '#9CA3AF', marginBottom: 14 },

  // Weekly chart
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8 },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartVal: { fontSize: 10, fontWeight: '800' },
  chartValEmpty: { fontSize: 10, color: '#C5C6D0' },
  chartBarArea: { justifyContent: 'flex-end', width: '60%' },
  chartBar: { width: '100%', minHeight: 4 },
  chartDayLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: 4 },
  chartDayToday: { color: '#6C63FF', fontWeight: '900' },

  // Cholesterol status
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  riskPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  riskPillText: { fontSize: 11, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F0F2FF' },
  statusAbbrevBox: { width: 42, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statusAbbrev: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  statusBarBg: { height: 5, backgroundColor: '#F0F2FF', borderRadius: 3, overflow: 'hidden', marginBottom: 3 },
  statusBarFill: { height: 5, borderRadius: 3 },
  statusIdeal: { fontSize: 10, color: '#C5C6D0' },
  statusRight: { alignItems: 'flex-end', gap: 3 },
  statusVal: { fontSize: 15, fontWeight: '800' },
  statusChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusChipText: { fontSize: 10, fontWeight: '700' },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: '#6B7280' },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dayCell: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNum: { fontSize: 11, fontWeight: '700' },

  trendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F0F2FF' },
  trendLabel: { width: 36, fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  trendOld: { flex: 1, fontSize: 12, color: '#9CA3AF' },
  trendArrow: { fontSize: 16, fontWeight: '900', marginHorizontal: 6 },
  trendNew: { flex: 1, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  trendDiff: { width: 44, fontSize: 11, textAlign: 'right' },

  // Fiber card
  fiberHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  fiberBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  fiberBadgeText: { fontSize: 11, fontWeight: '800' },
  fiberBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  fiberBarBg: { flex: 1, height: 8, backgroundColor: '#F0F2FF', borderRadius: 4, overflow: 'hidden' },
  fiberBarFill: { height: 8, borderRadius: 4 },
  fiberVal: { fontSize: 13, fontWeight: '800', width: 80, textAlign: 'right' },
  fiberHint: { fontSize: 12, color: '#9CA3AF' },

  // Report-meal correlation
  correlationPlaceholder: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EEF0FF', borderRadius: 12, padding: 14, marginTop: 4 },
  correlationPlaceholderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6C63FF', marginTop: 4 },
  correlationPlaceholderText: { flex: 1, fontSize: 13, color: '#3730A3', lineHeight: 19 },
  intervalBlock: { paddingVertical: 14 },
  intervalBlockBorder: { borderTopWidth: 1, borderTopColor: '#F0F2FF' },
  intervalTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  intervalDotRow: { flexDirection: 'column', alignItems: 'center', gap: 2 },
  iDot: { width: 8, height: 8, borderRadius: 4 },
  iLine: { width: 2, height: 14, backgroundColor: '#E5E5EA' },
  intervalDates: { fontSize: 14, fontWeight: '800', color: '#1A1A2E' },
  intervalMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  intervalRiskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  intervalRiskText: { fontSize: 11, fontWeight: '800' },
  intervalChanges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  changeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignItems: 'center' },
  changeLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  changeVal: { fontSize: 14, fontWeight: '900' },
  noMealsNote: { fontSize: 12, color: '#C5C6D0', marginTop: 8, fontStyle: 'italic' },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  badgeCard: {
    width: '47%', backgroundColor: '#F0F2FF', borderRadius: 16, padding: 14, alignItems: 'center',
  },
  badgeLocked: { backgroundColor: '#F8F8F8', opacity: 0.55 },
  badgeIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeIconText: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  badgeTitle: { fontSize: 12, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 3 },
  badgeDesc: { fontSize: 10, color: '#9CA3AF', textAlign: 'center', lineHeight: 14 },
  badgeTextLocked: { color: '#C5C6D0' },
  lockedLabel: { fontSize: 10, color: '#C5C6D0', marginTop: 4 },
});
