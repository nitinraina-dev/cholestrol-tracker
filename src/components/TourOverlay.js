import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  Animated, StyleSheet, Dimensions,
} from 'react-native';
import { useTour, TOUR_STEPS } from '../contexts/TourContext';

const { width: SW, height: SH } = Dimensions.get('window');
const PAD = 10;

export default function TourOverlay() {
  const { active, spotlightRect, currentStep, stepIndex, nextStep, skipTour } = useTour();
  const pulse = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || !spotlightRect) return;

    fadeIn.setValue(0);
    Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, spotlightRect]);

  if (!active || !spotlightRect || !currentStep) return null;

  const { x, y, w, h } = spotlightRect;
  const sx = Math.max(0, x - PAD);
  const sy = Math.max(0, y - PAD);
  const sw = Math.min(SW - sx, w + PAD * 2);
  const sh = Math.min(SH - sy, h + PAD * 2);

  // Decide tooltip placement
  const spaceBelow = SH - (sy + sh);
  const showBelow = spaceBelow >= 220 || sy < 220;

  // Arrow horizontal offset, centered on spotlight, clamped to stay in tooltip
  const spotCX = sx + sw / 2;
  const arrowMargin = Math.min(Math.max(spotCX - 16 - 12, 8), SW - 32 - 44);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Modal visible transparent statusBarTranslucent animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeIn }]} pointerEvents="box-none">

        {/* ── 4-piece dim overlay ── */}
        {/* Top */}
        <View style={[s.dim, { top: 0, left: 0, right: 0, height: sy }]} />
        {/* Bottom */}
        <View style={[s.dim, { top: sy + sh, left: 0, right: 0, bottom: 0 }]} />
        {/* Left */}
        <View style={[s.dim, { top: sy, left: 0, width: sx, height: sh }]} />
        {/* Right */}
        <View style={[s.dim, { top: sy, left: sx + sw, right: 0, height: sh }]} />

        {/* ── Pulsing spotlight ring ── */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.spotRing,
            {
              top: sy, left: sx, width: sw, height: sh,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />

        {/* ── Corner brackets for Apple-style feel ── */}
        {[
          { top: sy - 2, left: sx - 2 },
          { top: sy - 2, right: SW - (sx + sw) - 2, transform: [{ scaleX: -1 }] },
          { top: sy + sh - 10, left: sx - 2, transform: [{ scaleY: -1 }] },
          { top: sy + sh - 10, right: SW - (sx + sw) - 2, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
        ].map((pos, i) => (
          <View key={i} pointerEvents="none" style={[s.bracket, pos]}>
            <View style={s.bracketH} />
            <View style={s.bracketV} />
          </View>
        ))}

        {/* ── Tooltip ── */}
        <View
          style={[
            s.tooltipWrap,
            showBelow
              ? { top: sy + sh + 14 }
              : { bottom: SH - sy + 14 },
          ]}
          pointerEvents="box-none"
        >
          {showBelow && (
            <View style={[s.arrowUp, { marginLeft: arrowMargin }]} />
          )}

          <View style={s.card}>
            {/* Progress dots */}
            <View style={s.dotsRow}>
              {TOUR_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[s.dot, i === stepIndex && s.dotActive, i < stepIndex && s.dotDone]}
                />
              ))}
            </View>

            <Text style={s.stepLabel}>
              Step {stepIndex + 1} of {TOUR_STEPS.length}
            </Text>
            <Text style={s.title}>{currentStep.title}</Text>
            <Text style={s.body}>{currentStep.body}</Text>

            <View style={s.actions}>
              <TouchableOpacity
                onPress={skipTour}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              >
                <Text style={s.skipText}>Skip tour</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.nextBtn} onPress={nextStep} activeOpacity={0.8}>
                <Text style={s.nextBtnText}>
                  {stepIndex >= TOUR_STEPS.length - 1 ? 'Done!' : 'Next  →'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {!showBelow && (
            <View style={[s.arrowDown, { marginLeft: arrowMargin }]} />
          )}
        </View>

      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  spotRing: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#6C63FF',
  },

  // Corner bracket decoration
  bracket: { position: 'absolute', width: 16, height: 16 },
  bracketH: { position: 'absolute', top: 0, left: 0, width: 16, height: 3, backgroundColor: '#6C63FF', borderRadius: 2 },
  bracketV: { position: 'absolute', top: 0, left: 0, width: 3, height: 16, backgroundColor: '#6C63FF', borderRadius: 2 },

  tooltipWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  arrowUp: {
    width: 0, height: 0,
    borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 11,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#12122A',
    alignSelf: 'flex-start',
    marginBottom: -1,
  },
  arrowDown: {
    width: 0, height: 0,
    borderLeftWidth: 11, borderRightWidth: 11, borderTopWidth: 11,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#12122A',
    alignSelf: 'flex-start',
    marginTop: -1,
  },

  card: {
    backgroundColor: '#12122A',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#6C63FF',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
    borderWidth: 1,
    borderColor: '#ffffff12',
  },

  dotsRow: { flexDirection: 'row', gap: 5, marginBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff22' },
  dotActive: { width: 22, borderRadius: 3, backgroundColor: '#6C63FF' },
  dotDone: { backgroundColor: '#6C63FF66' },

  stepLabel: { fontSize: 10, fontWeight: '700', color: '#6C63FF', letterSpacing: 1.2, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 7 },
  body: { fontSize: 14, color: '#FFFFFFBB', lineHeight: 21, marginBottom: 18 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipText: { fontSize: 13, color: '#ffffff44', fontWeight: '500' },
  nextBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 11,
  },
  nextBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
