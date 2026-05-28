import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { markOnboardingComplete } from '../services/onboardingStorage';

const { width: W, height: H } = Dimensions.get('window');

// ── Slide illustrations (pure View-based) ────────────────────────────────────

function IllustrationWelcome() {
  return (
    <View style={il.center}>
      <View style={[il.bigCircle, { backgroundColor: '#6C63FF20' }]}>
        <View style={[il.medCircle, { backgroundColor: '#6C63FF40' }]}>
          <View style={[il.smallCircle, { backgroundColor: '#6C63FF' }]}>
            <Text style={il.ctText}>CT</Text>
          </View>
        </View>
      </View>
      {/* Pulse line */}
      <View style={il.pulseRow}>
        {[1, 2, 1, 3, 1, 2, 1].map((h, i) => (
          <View key={i} style={[il.pulseBar, { height: h * 8, backgroundColor: '#6C63FF' }]} />
        ))}
      </View>
    </View>
  );
}

function IllustrationScan() {
  return (
    <View style={il.center}>
      <View style={il.phoneBorder}>
        {/* Camera lens */}
        <View style={il.lensOuter}>
          <View style={il.lensInner} />
        </View>
        {/* Scan lines */}
        <View style={il.scanLine} />
        {/* Food plate */}
        <View style={il.plate}>
          <View style={il.plateInner} />
        </View>
      </View>
      {/* Risk color strips */}
      <View style={il.stripRow}>
        <View style={[il.strip, { backgroundColor: '#00C48C' }]}><Text style={il.stripText}>SAFE</Text></View>
        <View style={[il.strip, { backgroundColor: '#FF8C00' }]}><Text style={il.stripText}>MODERATE</Text></View>
        <View style={[il.strip, { backgroundColor: '#FF4757' }]}><Text style={il.stripText}>AVOID</Text></View>
      </View>
    </View>
  );
}

function IllustrationReport() {
  return (
    <View style={il.center}>
      <View style={il.docOuter}>
        <View style={il.docHeader} />
        {[1, 0.6, 1, 0.6, 1].map((w, i) => (
          <View key={i} style={[il.docLine, { width: `${w * 70}%` }]} />
        ))}
        {/* Values colored */}
        <View style={il.docValueRow}>
          <View style={[il.docVal, { backgroundColor: '#FF475730' }]}><Text style={[il.docValText, { color: '#FF4757' }]}>LDL 145</Text></View>
          <View style={[il.docVal, { backgroundColor: '#00C48C30' }]}><Text style={[il.docValText, { color: '#00C48C' }]}>HDL 42</Text></View>
        </View>
      </View>
      {/* Upload arrow */}
      <View style={il.uploadArrow}>
        <View style={il.arrowShaft} />
        <View style={il.arrowHead} />
      </View>
    </View>
  );
}

function IllustrationHome() {
  return (
    <View style={il.center}>
      {/* Score mockup */}
      <View style={il.scoreMock}>
        <View style={[il.scoreDot, { backgroundColor: '#30D158' }]} />
        <Text style={il.scoreNum}>3.2</Text>
        <Text style={il.scoreLabel}>Safe day</Text>
      </View>
      {/* Water bar */}
      <View style={il.waterMock}>
        <View style={il.waterLabel} />
        <View style={il.waterBar}>
          <View style={[il.waterFill, { width: '65%' }]} />
        </View>
      </View>
      {/* Meal rows */}
      {[0.8, 0.6, 0.9].map((w, i) => (
        <View key={i} style={il.mealRow}>
          <View style={[il.mealDot, { backgroundColor: i === 1 ? '#FF8C00' : '#00C48C' }]} />
          <View style={[il.mealLine, { width: `${w * 60}%` }]} />
        </View>
      ))}
    </View>
  );
}

function IllustrationInsights() {
  const bars = [4, 7, 3, 8, 5, 2, 6];
  const colors = ['#00C48C', '#FF4757', '#00C48C', '#FF4757', '#FF8C00', '#00C48C', '#FF8C00'];
  return (
    <View style={il.center}>
      {/* Bar chart */}
      <View style={il.barChart}>
        {bars.map((h, i) => (
          <View key={i} style={il.barCol}>
            <View style={[il.bar, { height: h * 8, backgroundColor: colors[i] }]} />
            <View style={il.barLabel} />
          </View>
        ))}
      </View>
      {/* Trend line */}
      <View style={il.trendRow}>
        {[2, 5, 3, 7, 4, 2, 3].map((h, i) => (
          <View key={i} style={[il.trendDot, { marginTop: (8 - h) * 3, backgroundColor: '#6C63FF' }]} />
        ))}
      </View>
    </View>
  );
}

function IllustrationReady() {
  return (
    <View style={il.center}>
      <View style={il.readyCircle}>
        {/* Big checkmark */}
        <View style={il.checkArm} />
        <View style={il.checkLeg} />
      </View>
      <Text style={il.readyStar}>+</Text>
    </View>
  );
}

const il = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  bigCircle: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center' },
  medCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  smallCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  ctText: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  pulseRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 16 },
  pulseBar: { width: 8, borderRadius: 4 },

  phoneBorder: { width: 100, height: 140, borderRadius: 14, borderWidth: 3, borderColor: '#6C63FF', alignItems: 'center', padding: 10, gap: 6 },
  lensOuter: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#6C63FF', alignItems: 'center', justifyContent: 'center' },
  lensInner: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#6C63FF30' },
  scanLine: { width: '90%', height: 2, backgroundColor: '#FF4757', opacity: 0.7 },
  plate: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
  plateInner: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#E5E5EA' },
  stripRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  strip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  stripText: { fontSize: 10, fontWeight: '900', color: '#fff' },

  docOuter: { backgroundColor: '#F8F8FC', borderRadius: 14, padding: 16, width: 160, gap: 6 },
  docHeader: { height: 12, backgroundColor: '#6C63FF', borderRadius: 4, width: '60%', marginBottom: 4 },
  docLine: { height: 6, backgroundColor: '#E5E5EA', borderRadius: 3 },
  docValueRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  docVal: { flex: 1, borderRadius: 6, padding: 5, alignItems: 'center' },
  docValText: { fontSize: 10, fontWeight: '800' },
  uploadArrow: { alignItems: 'center', marginTop: 12 },
  arrowShaft: { width: 3, height: 20, backgroundColor: '#6C63FF' },
  arrowHead: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#6C63FF', transform: [{ rotate: '180deg' }] },

  scoreMock: { backgroundColor: '#30D15818', borderRadius: 14, padding: 14, alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 10, width: 180 },
  scoreDot: { width: 10, height: 10, borderRadius: 5 },
  scoreNum: { fontSize: 22, fontWeight: '900', color: '#1A1A2E' },
  scoreLabel: { fontSize: 12, color: '#9CA3AF' },
  waterMock: { width: 180, gap: 4, marginBottom: 8 },
  waterLabel: { height: 6, width: 60, backgroundColor: '#E5E5EA', borderRadius: 3 },
  waterBar: { height: 8, backgroundColor: '#E5E5EA', borderRadius: 4, overflow: 'hidden' },
  waterFill: { height: 8, backgroundColor: '#6C63FF', borderRadius: 4 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 180, marginVertical: 3 },
  mealDot: { width: 8, height: 8, borderRadius: 4 },
  mealLine: { height: 8, backgroundColor: '#F0F2FF', borderRadius: 4 },

  barChart: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 80 },
  barCol: { alignItems: 'center', gap: 3 },
  bar: { width: 20, borderRadius: 4 },
  barLabel: { width: 14, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2 },
  trendRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8 },
  trendDot: { width: 8, height: 8, borderRadius: 4 },

  readyCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#00C48C', alignItems: 'center', justifyContent: 'center' },
  checkArm: { width: 24, height: 4, backgroundColor: '#fff', borderRadius: 2, transform: [{ rotate: '50deg' }, { translateX: -4 }, { translateY: 8 }] },
  checkLeg: { width: 44, height: 4, backgroundColor: '#fff', borderRadius: 2, transform: [{ rotate: '-40deg' }, { translateX: 10 }, { translateY: -4 }] },
  readyStar: { fontSize: 48, color: '#FF9F0A', fontWeight: '900', marginTop: 8 },
});

// ── Slide data ────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: 'welcome',
    IllustrationComponent: IllustrationWelcome,
    bgColor: '#1A1A2E',
    titleColor: '#fff',
    subColor: '#9CA3AF',
    title: 'Welcome!',
    sub: 'Your personal cholesterol tracker',
    body: 'This app helps you protect your heart — track your food, upload blood reports, and watch your progress, all in one place.',
  },
  {
    key: 'scan',
    IllustrationComponent: IllustrationScan,
    bgColor: '#6C63FF',
    titleColor: '#fff',
    subColor: '#ffffffBB',
    title: 'Scan Your Food',
    sub: 'AI tells you in 1 second if it\'s safe',
    body: 'Before eating anything — tap the "Scan" tab at the bottom and take a photo. The app will instantly tell you.',
  },
  {
    key: 'report',
    IllustrationComponent: IllustrationReport,
    bgColor: '#3B82F6',
    titleColor: '#fff',
    subColor: '#ffffffBB',
    title: 'Upload Your Blood Report',
    sub: 'Get advice based on your actual numbers',
    body: 'Open the "More" tab → tap "Blood Reports" → take a photo of your cholesterol report or upload a PDF.',
  },
  {
    key: 'home',
    IllustrationComponent: IllustrationHome,
    bgColor: '#0A0A14',
    titleColor: '#fff',
    subColor: '#9CA3AF',
    title: 'Your Daily Summary',
    sub: 'Food, water, and risk — all in one place',
    body: 'Every day on the Home screen, see your risk score, how much water you drank, and what you ate today.',
  },
  {
    key: 'insights',
    IllustrationComponent: IllustrationInsights,
    bgColor: '#1A1A2E',
    titleColor: '#fff',
    subColor: '#9CA3AF',
    title: 'Watch Your Progress',
    sub: 'See how your meals affect your reports',
    body: 'In the "Insights" tab — see weekly charts, fiber goals, and how your cholesterol changed between blood tests.',
  },
  {
    key: 'ready',
    IllustrationComponent: IllustrationReady,
    bgColor: '#00875A',
    titleColor: '#fff',
    subColor: '#ffffffBB',
    title: 'You\'re Ready!',
    sub: 'Small steps, big difference',
    body: 'Take your first step now: before eating anything, tap the "Scan" tab at the bottom and take your first photo!',
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingScreen({ onComplete }) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);

  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  const handleNext = async () => {
    if (isLast) {
      await markOnboardingComplete();
      onComplete();
    } else {
      setIdx(i => i + 1);
    }
  };

  const handleSkip = async () => {
    await markOnboardingComplete();
    onComplete();
  };

  const Illustration = slide.IllustrationComponent;

  return (
    <View style={[styles.root, { backgroundColor: slide.bgColor }]}>
      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 16 }]}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Illustration area */}
      <View style={styles.illustrationArea}>
        <Illustration />
      </View>

      {/* Content card */}
      <View style={[styles.contentCard, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.title, { color: '#1A1A2E' }]}>{slide.title}</Text>
        <Text style={styles.sub}>{slide.sub}</Text>
        <Text style={styles.body}>{slide.body}</Text>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === idx ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.bgColor }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {isLast ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        {idx > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setIdx(i => i - 1)}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  skipBtn: {
    position: 'absolute', right: 20, zIndex: 10,
    backgroundColor: '#ffffff25', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  skipText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  illustrationArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },

  contentCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 28, paddingTop: 32,
  },
  title: { fontSize: 30, fontWeight: '900', color: '#1A1A2E', marginBottom: 6 },
  sub: { fontSize: 15, fontWeight: '600', color: '#6C63FF', marginBottom: 14 },
  body: { fontSize: 16, color: '#4B5563', lineHeight: 26, marginBottom: 24 },

  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 28, backgroundColor: '#6C63FF' },
  dotInactive: { width: 8, backgroundColor: '#E5E5EA' },

  nextBtn: {
    borderRadius: 18, paddingVertical: 18, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
    marginBottom: 12,
  },
  nextBtnText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },

  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backBtnText: { color: '#9CA3AF', fontSize: 15, fontWeight: '600' },
});
