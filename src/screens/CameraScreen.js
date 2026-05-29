import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert, ScrollView, BackHandler,
  TextInput, Keyboard, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { analyzeFoodImage, analyzeTextMeal, analyzeProductText, chatAboutMeal, recalculateMealScore, RateLimitError } from '../services/gemini';
import { saveMeal, getMeals } from '../services/storage';
import { getLatestReport, getReports } from '../services/reportStorage';
import { getDietPreference, getLanguagePreference } from '../services/settingsStorage';
import { refreshBadges } from '../services/streakStorage';
import RiskBadge from '../components/RiskBadge';
import NutrientRow from '../components/NutrientRow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTour } from '../contexts/TourContext';

const NUTRIENT_GUIDE = [
  { key: 'saturatedFat', label: 'Saturated Fat',  limit: '<20g/day',   impact: 'bad',     desc: 'Found in butter, red meat and full-fat dairy. Directly raises LDL ("bad") cholesterol. The most common dietary driver of high LDL.' },
  { key: 'transFat',     label: 'Trans Fat',       limit: '<2g/day',    impact: 'bad',     desc: 'Found in partially hydrogenated oils, vanaspati and packaged snacks. The worst fat for your heart — raises LDL and lowers HDL ("good") cholesterol at the same time.' },
  { key: 'cholesterol',  label: 'Cholesterol',     limit: '<200mg/day', impact: 'bad',     desc: 'Dietary cholesterol from egg yolks, organ meat and shellfish. Raises blood cholesterol especially when LDL or VLDL is already high.' },
  { key: 'sugar',        label: 'Sugar',            limit: '<25g/day',   impact: 'bad',     desc: 'Excess sugar is converted to triglycerides by the liver. High triglycerides are a major heart disease risk, separate from LDL.' },
  { key: 'fiber',        label: 'Fiber',            limit: '>25g/day',   impact: 'good',    desc: 'Soluble fiber (oats, dal, fruits) binds bile acid and removes LDL from the bloodstream. One of the most effective dietary ways to lower LDL.' },
  { key: 'omega3',       label: 'Omega-3',          limit: '>2g/day',    impact: 'good',    desc: 'Found in fish, flaxseed and walnuts. Reduces triglycerides, lowers inflammation and slightly raises HDL. Does not raise LDL.' },
  { key: 'protein',      label: 'Protein',          limit: '>50g/day',   impact: 'neutral', desc: 'Does not directly affect cholesterol. Keeps you full longer, reducing snacking on unhealthy foods, and preserves muscle mass.' },
];

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
  const { bottom: insetBottom } = useSafeAreaInsets();
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
  const [originalResult, setOriginalResult] = useState(null);
  const [scoreComparison, setScoreComparison] = useState(null);
  const [showNutrientGuide, setShowNutrientGuide] = useState(false);
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [foodHint, setFoodHint] = useState('');
  const [textDescription, setTextDescription] = useState('');
  const cameraRef = useRef(null);
  const menuOptionsRef = useRef(null);
  const analyzeRef = useRef(null);
  const retryCountRef = useRef(0);
  const scrollRef = useRef(null);
  const [kbPad, setKbPad] = useState(0);
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

  useEffect(() => {
    setKbPad(insetBottom);
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => {
      // Always add insetBottom: Android often omits the nav-bar height from endCoordinates
      setKbPad(e.endCoordinates.height + insetBottom);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    };
    const onHide = () => setKbPad(insetBottom);
    const s1 = Keyboard.addListener(showEv, onShow);
    const s2 = Keyboard.addListener(hideEv, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, [insetBottom]);

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
      const analysis = await analyzeFoodImage(imageUri, report, diet, lang, foodHint);
      retryCountRef.current = 0;
      setResult(analysis);
      setOriginalResult(analysis);
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

  const analyzeText = async () => {
    const desc = textDescription.trim();
    if (!desc) return;
    setLoading(true);
    try {
      const [report, diet, lang] = await Promise.all([getLatestReport(), getDietPreference(), getLanguagePreference()]);
      setLatestReport(report);
      const analysis = await analyzeTextMeal(desc, report, diet, lang);
      setResult(analysis);
      setOriginalResult(analysis);
      setChatMessages([]);
      setMode('result');
    } catch {
      Alert.alert('Unable to analyze', 'Please try again in a few minutes.');
    } finally {
      setLoading(false);
    }
  };

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
    const beforeScore = result.riskScore;
    const beforeLevel = result.riskLevel;
    try {
      const lang = await getLanguagePreference();
      const updated = await recalculateMealScore(result, chatMessages, latestReport, lang);
      setScoreComparison({ beforeScore, beforeLevel, afterScore: updated.riskScore, afterLevel: updated.riskLevel });
      setResult(updated);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 260, animated: true }), 400);
    } catch {
      // silently ignore — keep existing result
    } finally {
      setRecalculating(false);
    }
  };

  const saveAndGoHome = async () => {
    await saveMeal({ id: Date.now().toString(), timestamp: new Date().toISOString(), imageUri: imageUri || null, textDescription: textDescription.trim() || null, analysis: result });
    const [allMeals, allReports] = await Promise.all([getMeals(), getReports()]);
    await refreshBadges(allMeals, allReports);
    reset();
    navigation.navigate('HomeTab');
  };

  const reset = () => { setMode('menu'); setImageUri(null); setResult(null); setOriginalResult(null); setScoreComparison(null); setChatMessages([]); setChatInput(''); setShowRecalculate(false); setBarcodeScanned(false); setBarcodeLoading(false); setFoodHint(''); setTextDescription(''); };

  const openBarcodeScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { Alert.alert('Camera permission required'); return; }
    }
    setBarcodeScanned(false);
    setMode('barcode');
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (barcodeScanned || barcodeLoading) return;
    setBarcodeScanned(true);
    setBarcodeLoading(true);
    try {
      const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${data}.json`);
      const json = await resp.json();
      if (json.status !== 1 || !json.product) {
        Alert.alert('Product not found', 'This barcode was not found in the food database. Try another product.', [
          { text: 'Try Again', onPress: () => { setBarcodeScanned(false); setBarcodeLoading(false); } },
          { text: 'Cancel', onPress: reset },
        ]);
        return;
      }
      const p = json.product;
      const n = p.nutriments || {};
      const nutriments = {
        saturatedFat: n['saturated-fat_serving'] ?? n['saturated-fat_100g'] ?? 0,
        transFat:     n['trans-fat_serving'] ?? n['trans-fat_100g'] ?? 0,
        cholesterol:  n['cholesterol_serving'] ?? n['cholesterol_100g'] ?? 0,
        totalCarbs:   n['carbohydrates_serving'] ?? n['carbohydrates_100g'] ?? 0,
        sugar:        n['sugars_serving'] ?? n['sugars_100g'] ?? 0,
        fiber:        n['fiber_serving'] ?? n['fibers_serving'] ?? n['fiber_100g'] ?? 0,
        omega3:       0,
        protein:      n['proteins_serving'] ?? n['proteins_100g'] ?? 0,
      };
      const [report, diet, lang] = await Promise.all([getLatestReport(), getDietPreference(), getLanguagePreference()]);
      setLatestReport(report);
      const analysis = await analyzeProductText(
        p.product_name || p.product_name_en || 'Unknown Product',
        p.brands || '',
        p.serving_size || '',
        nutriments,
        report,
        diet,
        lang
      );
      setResult(analysis);
      setOriginalResult(analysis);
      setChatMessages([]);
      setMode('result');
    } catch (e) {
      Alert.alert('Error', 'Could not fetch product info. Check your internet connection.', [
        { text: 'Try Again', onPress: () => { setBarcodeScanned(false); setBarcodeLoading(false); } },
        { text: 'Cancel', onPress: reset },
      ]);
    } finally {
      setBarcodeLoading(false);
    }
  };

  // ── Barcode scanner view ───────────────────────────────────────────────────
  if (mode === 'barcode') {
    return (
      <View style={styles.full}>
        <CameraView
          style={styles.full}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
          onBarcodeScanned={barcodeScanned ? undefined : handleBarcodeScanned}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraTopBar}>
              <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.cameraFrame, { borderColor: barcodeLoading ? '#FF9F0A' : '#6C63FF' }]} />
            <Text style={styles.cameraHint}>
              {barcodeLoading ? 'Looking up product...' : 'Point at barcode on packaging'}
            </Text>
            {barcodeLoading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#6C63FF" />
                <Text style={styles.loadingTitle}>Fetching product info</Text>
                <Text style={styles.loadingHint}>Checking Open Food Facts database...</Text>
              </View>
            )}
            {!barcodeLoading && <View style={{ width: 60 }} />}
          </View>
        </CameraView>
      </View>
    );
  }

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
            <View style={styles.previewBottom}>
              <View style={styles.hintBox}>
                <Text style={styles.hintLabel}>What are you eating? (optional)</Text>
                <TextInput
                  style={styles.hintInput}
                  value={foodHint}
                  onChangeText={setFoodHint}
                  placeholder='e.g. "tofu stir fry with broccoli"'
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                  maxLength={120}
                />
              </View>
              <View style={styles.previewActions}>
                <TouchableOpacity style={styles.retakeBtn} onPress={reset}>
                  <Text style={styles.retakeBtnText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.analyzeBtn} onPress={analyze}>
                  <Text style={styles.analyzeBtnText}>Analyze Meal</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Text log view ──────────────────────────────────────────────────────────
  if (mode === 'textlog') {
    return (
      <View style={[styles.full, { backgroundColor: '#F2F2F7' }]}>
        <View style={styles.textlogHeader}>
          <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.textlogTitle}>Describe Your Meal</Text>
          <View style={{ width: 60 }} />
        </View>
        {loading ? (
          <View style={styles.textlogLoading}>
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text style={styles.loadingTitle}>Analyzing your meal</Text>
            <Text style={styles.loadingHint}>Checking VLDL, LDL and Triglycerides impact</Text>
          </View>
        ) : (
          <View style={styles.textlogBody}>
            <Text style={styles.textlogPrompt}>
              Describe what you are eating — include ingredients, cooking method, and approximate portion if known.
            </Text>
            <TextInput
              style={styles.textlogInput}
              value={textDescription}
              onChangeText={setTextDescription}
              placeholder={'e.g. "Dal makhani with 2 rotis and a small bowl of rice"\nor "Tofu bhurji made with olive oil and bell peppers"'}
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
              maxLength={400}
              autoFocus
            />
            <Text style={styles.textlogCount}>{textDescription.length}/400</Text>
            <TouchableOpacity
              style={[styles.analyzeBtn, { marginTop: 12, borderRadius: 16 }, (!textDescription.trim()) && { backgroundColor: '#C7C7CC' }]}
              onPress={analyzeText}
              disabled={!textDescription.trim()}
            >
              <Text style={styles.analyzeBtnText}>Analyze Meal</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── Result view ────────────────────────────────────────────────────────────
  if (mode === 'result' && result) {
    const cfg = result.canEat ? (CAN_EAT_CONFIG[result.canEat] || CAN_EAT_CONFIG['IN MODERATION']) : null;
    const dot = result.canEat ? (STATUS_DOT[result.canEat] || STATUS_DOT['IN MODERATION']) : null;

    return (
      <View style={[styles.full, { paddingBottom: kbPad }]}>
        <ScrollView ref={scrollRef} style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.resultImage} resizeMode="cover" />
          ) : (
            <View style={styles.textResultBanner}>
              <View style={styles.textResultIconBox}>
                <View style={styles.textResultIconLine1} />
                <View style={styles.textResultIconLine2} />
                <View style={styles.textResultIconLine3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.textResultBannerTitle}>Meal Description</Text>
                <Text style={styles.textResultBannerDesc} numberOfLines={3}>{textDescription}</Text>
              </View>
            </View>
          )}

          <View style={styles.resultContent}>
            {scoreComparison && (
              <View style={styles.scoreCompBanner}>
                <Text style={styles.scoreCompBannerTitle}>Score Updated</Text>
                <View style={styles.scoreCompBannerRow}>
                  <View style={styles.scoreCompBannerItem}>
                    <Text style={styles.scoreCompBannerLabel}>Before</Text>
                    <Text style={styles.scoreCompBannerScore}>{scoreComparison.beforeScore}/10</Text>
                    <Text style={[styles.scoreCompBannerLevel, { color: scoreComparison.beforeLevel === 'HIGH' ? '#FF453A' : scoreComparison.beforeLevel === 'LOW' ? '#30D158' : '#FF9F0A' }]}>{scoreComparison.beforeLevel}</Text>
                  </View>
                  <View style={styles.scoreCompBannerArrow}>
                    <View style={styles.scoreCompArrowLine} />
                    <View style={styles.scoreCompArrowHead} />
                  </View>
                  <View style={styles.scoreCompBannerItem}>
                    <Text style={styles.scoreCompBannerLabel}>After</Text>
                    <Text style={[styles.scoreCompBannerScore, { color: scoreComparison.afterScore < scoreComparison.beforeScore ? '#30D158' : scoreComparison.afterScore > scoreComparison.beforeScore ? '#FF453A' : '#6C63FF' }]}>{scoreComparison.afterScore}/10</Text>
                    <Text style={[styles.scoreCompBannerLevel, { color: scoreComparison.afterLevel === 'HIGH' ? '#FF453A' : scoreComparison.afterLevel === 'LOW' ? '#30D158' : '#FF9F0A' }]}>{scoreComparison.afterLevel}</Text>
                  </View>
                  <View style={[styles.scoreCompTag, { backgroundColor: scoreComparison.afterScore < scoreComparison.beforeScore ? '#E6FBF5' : scoreComparison.afterScore > scoreComparison.beforeScore ? '#FFF0F1' : '#EEF0FF' }]}>
                    <Text style={[styles.scoreCompTagText, { color: scoreComparison.afterScore < scoreComparison.beforeScore ? '#00C48C' : scoreComparison.afterScore > scoreComparison.beforeScore ? '#FF4757' : '#6C63FF' }]}>
                      {scoreComparison.afterScore < scoreComparison.beforeScore ? 'Improved' : scoreComparison.afterScore > scoreComparison.beforeScore ? 'Worsened' : 'Unchanged'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

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
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Estimated Nutrients</Text>
                <TouchableOpacity style={styles.infoBtn} onPress={() => setShowNutrientGuide(v => !v)}>
                  <Text style={styles.infoBtnText}>i</Text>
                </TouchableOpacity>
              </View>
              {Object.entries(result.nutrients || {}).map(([k, v]) => (
                <NutrientRow key={k} name={k} value={v} />
              ))}
              {showNutrientGuide && (
                <View style={styles.nutrientGuide}>
                  <View style={styles.nutrientGuideDivider} />
                  <Text style={styles.nutrientGuideTitle}>What do these mean?</Text>
                  {NUTRIENT_GUIDE.map(item => (
                    <View key={item.key} style={styles.nutrientGuideItem}>
                      <View style={styles.nutrientGuideHeader}>
                        <Text style={styles.nutrientGuideLabel}>{item.label}</Text>
                        <View style={[styles.nutrientGuideTag, item.impact === 'bad' ? styles.nutrientGuideTagBad : item.impact === 'good' ? styles.nutrientGuideTagGood : styles.nutrientGuideTagNeutral]}>
                          <Text style={[styles.nutrientGuideTagText, item.impact === 'bad' ? { color: '#FF4757' } : item.impact === 'good' ? { color: '#00C48C' } : { color: '#8E8E93' }]}>{item.limit}</Text>
                        </View>
                      </View>
                      <Text style={styles.nutrientGuideDesc}>{item.desc}</Text>
                    </View>
                  ))}
                </View>
              )}
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
            <View style={{ height: 120 }} />
          </View>
        </ScrollView>

        {/* Sticky bars — paddingBottom on parent lifts these above keyboard */}
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
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionDiscard} onPress={reset}>
            <Text style={styles.actionDiscardText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionSave} onPress={saveAndGoHome}>
            <Text style={styles.actionSaveText}>Save to Log</Text>
          </TouchableOpacity>
        </View>
      </View>
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

        <TouchableOpacity style={[styles.menuBtn, styles.menuBtnSecondary]} onPress={openBarcodeScanner} activeOpacity={0.75}>
          <View style={[styles.menuBtnIconBox, { backgroundColor: '#00C48C12' }]}>
            <View style={styles.barcodeIconBox}>
              {[0, 1, 2, 3, 4].map(i => (
                <View key={i} style={[styles.barcodeBar, { width: i % 2 === 0 ? 2 : 3 }]} />
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuBtnTitle}>Scan Barcode</Text>
            <Text style={styles.menuBtnDesc}>Scan packaged food for instant nutrition lookup</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuBtn, styles.menuBtnSecondary]} onPress={() => setMode('textlog')} activeOpacity={0.75}>
          <View style={[styles.menuBtnIconBox, { backgroundColor: '#FF8C0012' }]}>
            <View style={styles.textlogMenuIcon}>
              <View style={[styles.textlogMenuLine, { width: 18 }]} />
              <View style={[styles.textlogMenuLine, { width: 14 }]} />
              <View style={[styles.textlogMenuLine, { width: 10 }]} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuBtnTitle}>Describe Your Meal</Text>
            <Text style={styles.menuBtnDesc}>Type what you ate — no photo needed</Text>
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
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  infoBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#EEF0FF', alignItems: 'center', justifyContent: 'center' },
  infoBtnText: { fontSize: 12, fontWeight: '800', color: '#6C63FF' },

  // Nutrient guide
  nutrientGuide: { marginTop: 8 },
  nutrientGuideDivider: { height: 1, backgroundColor: '#F2F2F7', marginBottom: 14 },
  nutrientGuideTitle: { fontSize: 11, fontWeight: '800', color: '#6C63FF', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  nutrientGuideItem: { marginBottom: 14 },
  nutrientGuideHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  nutrientGuideLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', flex: 1 },
  nutrientGuideTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  nutrientGuideTagBad: { backgroundColor: '#FFF0F1' },
  nutrientGuideTagGood: { backgroundColor: '#E6FBF5' },
  nutrientGuideTagNeutral: { backgroundColor: '#F2F2F7' },
  nutrientGuideTagText: { fontSize: 11, fontWeight: '700' },
  nutrientGuideDesc: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
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
  // Score comparison banner
  scoreCompBanner: { backgroundColor: '#1A1A2E', borderRadius: 18, padding: 18, marginBottom: 12 },
  scoreCompBannerTitle: { fontSize: 11, fontWeight: '800', color: '#6C63FF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  scoreCompBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  scoreCompBannerItem: { flex: 1, alignItems: 'center', gap: 4 },
  scoreCompBannerLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  scoreCompBannerScore: { fontSize: 26, fontWeight: '800', color: '#fff' },
  scoreCompBannerLevel: { fontSize: 11, fontWeight: '700' },
  scoreCompBannerArrow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  scoreCompArrowLine: { width: 20, height: 2, backgroundColor: '#8E8E93' },
  scoreCompArrowHead: { width: 0, height: 0, borderTopWidth: 5, borderBottomWidth: 5, borderLeftWidth: 8, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#8E8E93' },
  scoreCompTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginLeft: 8 },
  scoreCompTagText: { fontSize: 12, fontWeight: '800' },

  // Action bar
  actionBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E5E5EA' },
  actionDiscard: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#FF4757' },
  actionDiscardText: { color: '#FF4757', fontSize: 15, fontWeight: '700' },
  actionSave: { flex: 2, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#6C63FF', shadowColor: '#6C63FF', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  actionSaveText: { color: '#fff', fontSize: 15, fontWeight: '800' },

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
  barcodeIconBox: { flexDirection: 'row', gap: 2, alignItems: 'center', height: 20 },
  barcodeBar: { height: '100%', backgroundColor: '#00C48C', borderRadius: 1 },
  menuBtnTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  menuBtnTitleWhite: { fontSize: 16, fontWeight: '700', color: '#fff' },
  menuBtnDesc: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  menuBtnDescWhite: { fontSize: 13, color: '#ffffffAA', marginTop: 2 },
  chevron: { fontSize: 22, color: '#C7C7CC' },
  chevronWhite: { fontSize: 22, color: '#ffffff88' },
  scanTip: { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  scanTipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6C63FF', marginTop: 4 },
  scanTipText: { fontSize: 13, color: '#8E8E93', lineHeight: 19, flex: 1 },

  // Preview hint
  previewBottom: { gap: 12 },
  hintBox: { backgroundColor: '#ffffffF0', borderRadius: 18, padding: 16, gap: 8 },
  hintLabel: { fontSize: 12, fontWeight: '700', color: '#6C63FF', textTransform: 'uppercase', letterSpacing: 0.5 },
  hintInput: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1A1A2E' },

  // Text log mode
  textlogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA' },
  textlogTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  textlogLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  textlogBody: { flex: 1, padding: 20 },
  textlogPrompt: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  textlogInput: { backgroundColor: '#fff', borderRadius: 16, padding: 16, fontSize: 15, color: '#1A1A2E', minHeight: 160, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  textlogCount: { fontSize: 11, color: '#C7C7CC', textAlign: 'right', marginTop: 6 },

  // Text-only result banner
  textResultBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#EEF0FF', padding: 20, minHeight: 100 },
  textResultIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#6C63FF22', alignItems: 'center', justifyContent: 'center', gap: 5 },
  textResultIconLine1: { width: 22, height: 3, borderRadius: 2, backgroundColor: '#6C63FF' },
  textResultIconLine2: { width: 16, height: 3, borderRadius: 2, backgroundColor: '#6C63FF' },
  textResultIconLine3: { width: 10, height: 3, borderRadius: 2, backgroundColor: '#6C63FF' },
  textResultBannerTitle: { fontSize: 11, fontWeight: '700', color: '#6C63FF', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  textResultBannerDesc: { fontSize: 14, color: '#3730A3', lineHeight: 20 },

  // Text log menu icon
  textlogMenuIcon: { gap: 4, alignItems: 'flex-start', justifyContent: 'center' },
  textlogMenuLine: { height: 3, borderRadius: 2, backgroundColor: '#FF8C00' },
});
