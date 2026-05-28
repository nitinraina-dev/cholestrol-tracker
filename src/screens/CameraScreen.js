import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert, ScrollView, BackHandler,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { analyzeFoodImage, chatAboutMeal, recalculateMealScore, RateLimitError } from '../services/gemini';
import { saveMeal, getMeals } from '../services/storage';
import { getLatestReport, getReports } from '../services/reportStorage';
import { getDietPreference, getLanguagePreference } from '../services/settingsStorage';
import { refreshBadges } from '../services/streakStorage';
import RiskBadge from '../components/RiskBadge';
import NutrientRow from '../components/NutrientRow';
import { useTour } from '../contexts/TourContext';

const CAN_EAT_CONFIG = {
  YES:             { color: '#00C48C', bg: '#E6FBF5', border: '#00C48C', label: 'Safe to eat',       sub: 'Good choice for your cholesterol' },
  'IN MODERATION': { color: '#FF8C00', bg: '#FFF8EC', border: '#FF8C00', label: 'Eat in moderation', sub: 'Watch your portion size' },
  AVOID:           { color: '#FF4757', bg: '#FFF0F1', border: '#FF4757', label: 'Avoid this food',   sub: 'Bad for your cholesterol' },
};

const STATUS_DOT = {
  YES:             { color: '#00C48C' },
  'IN MODERATION': { color: '#FF8C00' },
  AVOID:           { color: '#FF4757' },
};

function FlashIcon({ active }) {
  const c = active ? '#FFD700' : '#fff';
  return (
    <View style={{ width: 18, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', top: 0, left: 5, width: 8, height: 14, backgroundColor: c, borderTopLeftRadius: 2, borderTopRightRadius: 4, borderBottomRightRadius: 0, borderBottomLeftRadius: 0, transform: [{ skewX: '-10deg' }] }} />
      <View style={{ position: 'absolute', bottom: 0, right: 5, width: 8, height: 14, backgroundColor: c, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomRightRadius: 2, borderBottomLeftRadius: 4, transform: [{ skewX: '-10deg' }] }} />
    </View>
  );
}

export default function CameraScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState('menu');
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [latestReport, setLatestReport] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [flash, setFlash] = useState('off');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showRecalculate, setShowRecalculate] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const cameraRef = useRef(null);
  const menuOptionsRef = useRef(null);
  const analyzeRef = useRef(null);
  const retryCountRef = useRef(0);
  const scrollRef = useRef(null);
  const { registerRef } = useTour();

  useEffect(() => {
    registerRef('cameraMenuOptions', menuOptionsRef);
  }, [registerRef]);

  useEffect(() => {
    const onBack = () => {
      if (mode === 'camera' || mode === 'preview') { reset(); return true; }
      if (mode === 'result') { setMode('menu'); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [mode]);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access in your device settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setMode('preview');
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { Alert.alert('Camera permission required'); return; }
    }
    setMode('camera');
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    setImageUri(photo.uri);
    setMode('preview');
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { analyzeRef.current?.(); return; }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const analyze = async () => {
    setCountdown(null);
    setLoading(true);
    try {
      const [report, diet, lang] = await Promise.all([getLatestReport(), getDietPreference(), getLanguagePreference()]);
      setLatestReport(report);
      const analysis = await analyzeFoodImage(imageUri, report, diet, lang);
      retryCountRef.current = 0;
      setResult(analysis);
      setChatMessages([]);
      setMode('result');
      setLoading(false);
    } catch (e) {
      if (e instanceof RateLimitError && retryCountRef.current < 2 && (e.waitMs || 0) <= 120000) {
        retryCountRef.current++;
        setCountdown(Math.ceil((e.waitMs || 60000) / 1000));
      } else {
        retryCountRef.current = 0;
        setLoading(false);
        Alert.alert('Unable to analyze', 'Please try again in a few minutes.');
      }
    }
  };
  analyzeRef.current = analyze;

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg = { id: Date.now().toString(), role: 'user', text };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput('');
    setChatLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const lang = await getLanguagePreference();
      const reply = await chatAboutMeal(text, chatMessages, result, latestReport, lang);
      const aiMsg = { id: (Date.now() + 1).toString(), role: 'ai', text: reply };
      setChatMessages(prev => [...prev, aiMsg]);
      setShowRecalculate(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: 'Sorry, could not get a response. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const recalculate = async () => {
    setShowRecalculate(false);
    setRecalculating(true);
    try {
      const lang = await getLanguagePreference();
      const updated = await recalculateMealScore(result, chatMessages, latestReport, lang);
      setResult(updated);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    } catch {
      // silently ignore — keep existing result
    } finally {
      setRecalculating(false);
    }
  };

  const saveAndGoHome = async () => {
    await saveMeal({ id: Date.now().toString(), timestamp: new Date().toISOString(), imageUri, analysis: result });
    const [allMeals, allReports] = await Promise.all([getMeals(), getReports()]);
    await refreshBadges(allMeals, allReports);
    reset();
    navigation.navigate('HomeTab');
  };

  const reset = () => { setMode('menu'); setImageUri(null); setResult(null); setChatMessages([]); setChatInput(''); setShowRecalculate(false); };

  // ── Camera view ────────────────────────────────────────────────────────────
  if (mode === 'camera') {
    return (
      <View style={styles.full}>
        <CameraView ref={cameraRef} style={styles.full} facing="back" flash={flash}>
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraTopBar}>
              <TouchableOpacity style={[styles.flashBtn, flash === 'on' && styles.flashBtnOn]} onPress={() => setFlash(f => f === 'off' ? 'on' : 'off')}>
                <FlashIcon active={flash === 'on'} />
                <Text style={[styles.flashBtnText, flash === 'on' && styles.flashBtnTextOn]}>
                  {flash === 'on' ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cameraFrame} />
            <Text style={styles.cameraHint}>Point at your meal</Text>
            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('menu')}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shutterBtn} onPress={takePicture}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              <View style={{ width: 60 }} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  // ── Preview view ───────────────────────────────────────────────────────────
  if (mode === 'preview') {
    return (
      <View style={styles.full}>
        <Image source={{ uri: imageUri }} style={styles.full} resizeMode="cover" />
        <View style={styles.previewOverlay}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#6C63FF" />
              <Text style={styles.loadingTitle}>Analyzing your meal</Text>
              <Text style={styles.loadingHint}>
                {countdown !== null ? `Ready in ${countdown}s` : 'Checking VLDL, LDL and Triglycerides impact'}
              </Text>
              {latestReport && (
                <View style={styles.loadingReportBadge}>
                  <Text style={styles.loadingReportText}>Using your blood report</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeBtn} onPress={reset}>
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.analyzeBtn} onPress={analyze}>
                <Text style={styles.analyzeBtnText}>Analyze Meal</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Result view ────────────────────────────────────────────────────────────
  if (mode === 'result' && result) {
    const cfg = result.canEat ? (CAN_EAT_CONFIG[result.canEat] || CAN_EAT_CONFIG['IN MODERATION']) : null;
    const dot = result.canEat ? (STATUS_DOT[result.canEat] || STATUS_DOT['IN MODERATION']) : null;

    return (
      <KeyboardAvoidingView style={styles.full} behavior="padding" keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}>
        <ScrollView ref={scrollRef} style={styles.container} showsVerticalScrollIndicator={false}>
          <Image source={{ uri: imageUri }} style={styles.resultImage} resizeMode="cover" />

          <View style={styles.resultContent}>
            {cfg && (
              <View style={[styles.canEatCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                <View style={[styles.canEatDot, { backgroundColor: dot.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.canEatLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={styles.canEatSub}>{result.personalizedAdvice || cfg.sub}</Text>
                </View>
              </View>
            )}

            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultFoods}>{result.foods?.join(', ')}</Text>
                <Text style={styles.resultServing}>{result.servingNote}</Text>
              </View>
              <RiskBadge level={result.riskLevel} score={result.riskScore} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Estimated Nutrients</Text>
              {Object.entries(result.nutrients || {}).map(([k, v]) => (
                <NutrientRow key={k} name={k} value={v} />
              ))}
            </View>

            {result.warnings?.length > 0 && (
              <View style={[styles.card, styles.warnCard]}>
                <Text style={styles.cardTitle}>Cholesterol Warnings</Text>
                {result.warnings.map((w, i) => (
                  <View key={i} style={styles.warnRow}>
                    <View style={styles.warnBullet} />
                    <Text style={styles.warnText}>{w}</Text>
                  </View>
                ))}
              </View>
            )}

            {result.benefits?.length > 0 && (
              <View style={[styles.card, styles.benefitCard]}>
                <Text style={styles.cardTitle}>Benefits</Text>
                {result.benefits.map((b, i) => (
                  <View key={i} style={styles.benefitRow}>
                    <View style={styles.benefitBullet} />
                    <Text style={styles.benefitText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}

            {result.recommendation && (
              <View style={[styles.card, styles.recCard]}>
                <Text style={styles.cardTitle}>Recommendation</Text>
                <Text style={styles.recText}>{result.recommendation}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={saveAndGoHome}>
              <Text style={styles.saveBtnText}>Save to Log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.discardBtn} onPress={reset}>
              <Text style={styles.discardBtnText}>Discard</Text>
            </TouchableOpacity>

            {/* ── Chat section ── */}
            <View style={styles.chatSection}>
              <Text style={styles.chatSectionTitle}>Ask about this meal</Text>
              {chatMessages.length === 0 && (
                <View style={styles.chatEmptyHint}>
                  <Text style={styles.chatEmptyText}>Ask anything — "Can I eat this daily?", "What can I have instead?", "How much protein is this?"</Text>
                </View>
              )}
              {chatMessages.map(msg => (
                <View key={msg.id} style={msg.role === 'user' ? styles.userBubble : styles.aiBubble}>
                  <Text style={msg.role === 'user' ? styles.userBubbleText : styles.aiBubbleText}>{msg.text}</Text>
                </View>
              ))}
              {chatLoading && (
                <View style={styles.aiBubbleLoading}>
                  <ActivityIndicator size="small" color="#6C63FF" />
                </View>
              )}
              {showRecalculate && !chatLoading && (
                <View style={styles.recalcBanner}>
                  <Text style={styles.recalcBannerText}>Chat added new context — want me to update the score?</Text>
                  <View style={styles.recalcBannerRow}>
                    <TouchableOpacity style={styles.recalcYes} onPress={recalculate}>
                      <Text style={styles.recalcYesText}>Update Score</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.recalcNo} onPress={() => setShowRecalculate(false)}>
                      <Text style={styles.recalcNoText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {recalculating && (
                <View style={styles.recalcingRow}>
                  <ActivityIndicator size="small" color="#6C63FF" />
                  <Text style={styles.recalcingText}>Recalculating score...</Text>
                </View>
              )}
            </View>
            <View style={{ height: 80 }} />
          </View>
        </ScrollView>

        {/* Sticky chat input */}
        <View style={styles.chatInputBar}>
          <TextInput
            style={styles.chatInput}
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Ask about this meal..."
            placeholderTextColor="#C5C6D0"
            returnKeyType="send"
            onSubmitEditing={sendChat}
          />
          <TouchableOpacity
            style={[styles.chatSendBtn, (!chatInput.trim() || chatLoading) && styles.chatSendBtnDisabled]}
            onPress={sendChat}
            disabled={!chatInput.trim() || chatLoading}
          >
            <View style={styles.sendArrow} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Menu view ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.menuContainer, { paddingBottom: 24 }]}>
      <View style={styles.menuIntro}>
        <Text style={styles.menuLabel}>LOG A MEAL</Text>
        <Text style={styles.menuTitle}>How would you like{'\n'}to scan?</Text>
        <Text style={styles.menuSubtitle}>AI checks impact on your LDL, VLDL and Triglycerides</Text>
      </View>

      <View ref={menuOptionsRef} collapsable={false} style={styles.menuOptions}>
        <TouchableOpacity style={[styles.menuBtn, styles.menuBtnPrimary]} onPress={openCamera} activeOpacity={0.75}>
          <View style={[styles.menuBtnIconBox, { backgroundColor: '#ffffff22' }]}>
            <View style={styles.cameraIconBody}>
              <View style={styles.cameraIconLens} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuBtnTitleWhite}>Take a Photo</Text>
            <Text style={styles.menuBtnDescWhite}>Use camera to snap your meal</Text>
          </View>
          <Text style={styles.chevronWhite}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuBtn, styles.menuBtnSecondary]} onPress={pickFromGallery} activeOpacity={0.75}>
          <View style={[styles.menuBtnIconBox, { backgroundColor: '#6C63FF12' }]}>
            <View style={styles.galleryIconOuter}>
              <View style={styles.galleryIconInner} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuBtnTitle}>Upload from Gallery</Text>
            <Text style={styles.menuBtnDesc}>Choose an existing food photo</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scanTip}>
        <View style={styles.scanTipDot} />
        <Text style={styles.scanTipText}>
          Add a blood report in More → Blood Reports for a personalised verdict
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  // Camera
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 20, paddingTop: 60, paddingBottom: 50 },
  cameraTopBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  flashBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00000066', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#ffffff44',
  },
  flashBtnOn: { backgroundColor: '#00000099', borderColor: '#FFD700' },
  flashBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  flashBtnTextOn: { color: '#FFD700' },
  cameraFrame: {
    position: 'absolute', top: '25%', left: '10%', right: '10%', bottom: '30%',
    borderWidth: 2, borderColor: '#6C63FF', borderRadius: 16,
  },
  cameraHint: { color: '#fff', fontSize: 14, textAlign: 'center', fontWeight: '600', backgroundColor: '#00000066', padding: 8, borderRadius: 10, alignSelf: 'center' },
  cameraControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shutterBtn: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff33' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  cancelBtn: { padding: 12, backgroundColor: '#00000055', borderRadius: 12 },
  cancelBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Preview
  previewOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: 24, backgroundColor: 'rgba(0,0,0,0.25)' },
  loadingBox: { alignItems: 'center', backgroundColor: '#ffffffF0', borderRadius: 24, padding: 28, gap: 10 },
  loadingTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A2E' },
  loadingHint: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  loadingReportBadge: { backgroundColor: '#EEF0FF', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  loadingReportText: { fontSize: 12, color: '#6C63FF', fontWeight: '700' },
  previewActions: { flexDirection: 'row', gap: 12 },
  retakeBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#ffffff33', alignItems: 'center', borderWidth: 1, borderColor: '#ffffff66' },
  retakeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  analyzeBtn: { flex: 2, padding: 16, borderRadius: 16, backgroundColor: '#6C63FF', alignItems: 'center' },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Result
  resultImage: { width: '100%', height: 240 },
  resultContent: { padding: 16 },
  canEatCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1.5 },
  canEatDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  canEatLabel: { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  canEatSub: { fontSize: 13, color: '#555', lineHeight: 18 },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  resultFoods: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  resultServing: { fontSize: 13, color: '#9CA3AF', marginTop: 3 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  warnCard: { backgroundColor: '#FFF8EC', borderLeftWidth: 3, borderLeftColor: '#FF8C00' },
  warnRow: { flexDirection: 'row', gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  warnBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF8C00', marginTop: 5 },
  warnText: { fontSize: 13, color: '#7C4A00', flex: 1, lineHeight: 18 },
  benefitCard: { backgroundColor: '#E6FBF5', borderLeftWidth: 3, borderLeftColor: '#00C48C' },
  benefitRow: { flexDirection: 'row', gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  benefitBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00C48C', marginTop: 5 },
  benefitText: { fontSize: 13, color: '#005A3C', flex: 1, lineHeight: 18 },
  recCard: { backgroundColor: '#EEF0FF', borderLeftWidth: 3, borderLeftColor: '#6C63FF' },
  recText: { fontSize: 14, color: '#3730A3', lineHeight: 21 },
  saveBtn: { backgroundColor: '#6C63FF', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 10, shadowColor: '#6C63FF', shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  discardBtn: { padding: 14, alignItems: 'center', marginBottom: 8 },
  discardBtnText: { color: '#FF4757', fontSize: 15, fontWeight: '600' },

  // Chat
  chatSection: { marginTop: 8 },
  chatSectionTitle: { fontSize: 12, fontWeight: '800', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  chatEmptyHint: { backgroundColor: '#EEF0FF', borderRadius: 14, padding: 14, marginBottom: 8 },
  chatEmptyText: { fontSize: 13, color: '#6C63FF', lineHeight: 19 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#6C63FF', borderRadius: 16, borderBottomRightRadius: 4, padding: 12, marginBottom: 8, maxWidth: '80%' },
  userBubbleText: { color: '#fff', fontSize: 14, lineHeight: 20, flexShrink: 1 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 16, borderBottomLeftRadius: 4, padding: 12, marginBottom: 8, maxWidth: '80%', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  aiBubbleText: { color: '#1A1A2E', fontSize: 14, lineHeight: 20, flexShrink: 1 },
  aiBubbleLoading: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 16, borderBottomLeftRadius: 4, padding: 12, marginBottom: 8, minWidth: 48, minHeight: 40, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 1, alignItems: 'center', justifyContent: 'center' },
  recalcBanner: { backgroundColor: '#EEF0FF', borderRadius: 14, padding: 14, marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: '#6C63FF33' },
  recalcBannerText: { fontSize: 13, color: '#3730A3', lineHeight: 18, marginBottom: 10 },
  recalcBannerRow: { flexDirection: 'row', gap: 10 },
  recalcYes: { flex: 1, backgroundColor: '#6C63FF', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  recalcYesText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  recalcNo: { paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  recalcNoText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  recalcingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  recalcingText: { fontSize: 13, color: '#6C63FF', fontWeight: '600' },
  chatInputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', padding: 12,
    borderTopWidth: 0.5, borderTopColor: '#E5E5EA',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  chatInput: {
    flex: 1, backgroundColor: '#F2F2F7', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: '#1A1A2E',
  },
  chatSendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center',
  },
  chatSendBtnDisabled: { backgroundColor: '#C7C7CC' },
  sendArrow: {
    width: 0, height: 0,
    borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 12,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#fff',
    marginLeft: 3,
  },

  // Menu
  menuContainer: { flex: 1, backgroundColor: '#F2F2F7', padding: 24, justifyContent: 'center' },
  menuIntro: { marginBottom: 32 },
  menuLabel: { fontSize: 11, fontWeight: '700', color: '#6C63FF', letterSpacing: 1.2, marginBottom: 8 },
  menuTitle: { fontSize: 28, fontWeight: '700', color: '#000', lineHeight: 34, marginBottom: 8 },
  menuSubtitle: { fontSize: 14, color: '#8E8E93', lineHeight: 20 },
  menuOptions: { gap: 12, marginBottom: 24 },
  menuBtn: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 18 },
  menuBtnPrimary: { backgroundColor: '#6C63FF', shadowColor: '#6C63FF', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  menuBtnSecondary: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  menuBtnIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cameraIconBody: { width: 28, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cameraIconLens: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  galleryIconOuter: { width: 26, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#6C63FF', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 2 },
  galleryIconInner: { width: 12, height: 10, borderRadius: 2, backgroundColor: '#6C63FF', opacity: 0.5 },
  menuBtnTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  menuBtnTitleWhite: { fontSize: 16, fontWeight: '700', color: '#fff' },
  menuBtnDesc: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  menuBtnDescWhite: { fontSize: 13, color: '#ffffffAA', marginTop: 2 },
  chevron: { fontSize: 22, color: '#C7C7CC' },
  chevronWhite: { fontSize: 22, color: '#ffffff88' },
  scanTip: { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  scanTipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6C63FF', marginTop: 4 },
  scanTipText: { fontSize: 13, color: '#8E8E93', lineHeight: 19, flex: 1 },
});
