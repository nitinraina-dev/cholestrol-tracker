import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Dimensions, Platform } from 'react-native';
import { markTourComplete } from '../services/tourStorage';

const { width: SW, height: SH } = Dimensions.get('window');

// Tab bar sits at the bottom — approximate highlight rects for each of the 5 tabs
const TAB_BAR_H = Platform.OS === 'ios' ? 82 : 64;
const TAB_W = SW / 5;
const TAB_TOP = SH - TAB_BAR_H;

function tabRect(index) {
  return { x: index * TAB_W + 4, y: TAB_TOP + 4, w: TAB_W - 8, h: TAB_BAR_H - 8 };
}

export const TOUR_STEPS = [
  {
    key: 'home_score',
    title: 'Your Daily Risk Score',
    body: 'This card shows today\'s cholesterol risk. Green means safe, red means you need to be careful about what you eat.',
    refKey: 'homeScoreCard',
    tooltipSide: 'bottom',
  },
  {
    key: 'home_water',
    title: 'Track Your Water',
    body: 'Drinking 2.5L of water daily helps manage cholesterol. Tap the buttons below to log how much you drank.',
    refKey: 'homeWaterSection',
    tooltipSide: 'bottom',
  },
  {
    key: 'scan_tab',
    title: 'Scan Your Food',
    body: 'Tap this button before eating anything. Take a photo and the AI will instantly tell you if it\'s safe for your cholesterol.',
    tabIndex: 1,
    navigate: 'CameraTab',
    tooltipSide: 'top',
  },
  {
    key: 'camera_options',
    title: 'Take a Photo or Upload',
    body: 'Take a photo with your camera or pick one from your gallery. We\'ll automatically check the cholesterol impact.',
    refKey: 'cameraMenuOptions',
    tooltipSide: 'bottom',
  },
  {
    key: 'history_tab',
    title: 'View Past Meals',
    body: 'See everything you\'ve eaten before. Each meal shows its risk level and nutrition details.',
    tabIndex: 2,
    navigate: 'HistoryTab',
    tooltipSide: 'top',
  },
  {
    key: 'insights_tab',
    title: 'Health Trends',
    body: 'Weekly charts and graphs appear here. Track how your health is improving over time.',
    tabIndex: 3,
    navigate: 'InsightsTab',
    tooltipSide: 'top',
  },
  {
    key: 'more_tab',
    title: 'More Features',
    body: 'Upload blood reports, add doctor notes, and calculate your CVD risk — all in one place.',
    tabIndex: 4,
    navigate: 'MoreTab',
    tooltipSide: 'top',
  },
];

const TourContext = createContext(null);
export const useTour = () => useContext(TourContext);

export function TourProvider({ children, navigationRef }) {
  const [active, setActive]           = useState(false);
  const [stepIndex, setStepIndex]     = useState(0);
  const [spotlightRect, setRect]      = useState(null);
  const refs = useRef({});

  const registerRef = useCallback((key, ref) => {
    refs.current[key] = ref;
  }, []);

  const measureKey = useCallback((key) => {
    return new Promise((resolve) => {
      const ref = refs.current[key];
      if (!ref?.current) { resolve(null); return; }
      ref.current.measureInWindow((x, y, w, h) => {
        resolve(w > 0 && h > 0 ? { x, y, w, h } : null);
      });
    });
  }, []);

  const applyStep = useCallback(async (index) => {
    if (index >= TOUR_STEPS.length) {
      await markTourComplete();
      setActive(false);
      setRect(null);
      return;
    }

    const step = TOUR_STEPS[index];

    // Always hide spotlight during transitions so the dim overlay never
    // shows the wrong screen while a tab switch is animating.
    setRect(null);

    if (step.navigate && navigationRef?.current?.isReady?.()) {
      navigationRef.current.navigate(step.navigate);
      await new Promise(r => setTimeout(r, 750)); // wait for tab animation
    } else {
      await new Promise(r => setTimeout(r, 160)); // brief beat between same-screen steps
    }

    let rect = null;
    if (step.tabIndex !== undefined) {
      rect = tabRect(step.tabIndex);
    } else if (step.refKey) {
      rect = await measureKey(step.refKey);
    }

    // Fallback rect if measurement fails
    if (!rect) {
      rect = { x: SW * 0.05, y: SH * 0.25, w: SW * 0.9, h: SH * 0.12 };
    }

    // Set both atomically so tooltip text and spotlight appear together
    setStepIndex(index);
    setRect(rect);
  }, [measureKey, navigationRef]);

  const startTour = useCallback(async () => {
    setActive(true);
    setStepIndex(0);
    if (navigationRef?.current?.isReady?.()) {
      navigationRef.current.navigate('HomeTab');
    }
    await new Promise(r => setTimeout(r, 700));
    await applyStep(0);
  }, [applyStep, navigationRef]);

  const nextStep = useCallback(() => {
    applyStep(stepIndex + 1);
  }, [stepIndex, applyStep]);

  const skipTour = useCallback(async () => {
    await markTourComplete();
    setActive(false);
    setRect(null);
  }, []);

  return (
    <TourContext.Provider value={{
      active,
      stepIndex,
      spotlightRect,
      currentStep: TOUR_STEPS[stepIndex],
      registerRef,
      startTour,
      nextStep,
      skipTour,
    }}>
      {children}
    </TourContext.Provider>
  );
}
