import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen        from './src/screens/HomeScreen';
import CameraScreen      from './src/screens/CameraScreen';
import HistoryScreen     from './src/screens/HistoryScreen';
import MealDetailScreen  from './src/screens/MealDetailScreen';
import InsightsScreen    from './src/screens/InsightsScreen';
import MoreScreen        from './src/screens/MoreScreen';
import ReportScreen      from './src/screens/ReportScreen';
import SuggestionsScreen from './src/screens/SuggestionsScreen';
import SafeFoodsScreen   from './src/screens/SafeFoodsScreen';
import DoctorNotesScreen from './src/screens/DoctorNotesScreen';
import SettingsScreen    from './src/screens/SettingsScreen';
import ToolsScreen       from './src/screens/ToolsScreen';
import OnboardingScreen    from './src/screens/OnboardingScreen';
import AddReportScreen     from './src/screens/AddReportScreen';
import AddDoctorNoteScreen from './src/screens/AddDoctorNoteScreen';
import { isOnboardingComplete } from './src/services/onboardingStorage';
import { TourProvider, useTour } from './src/contexts/TourContext';
import TourOverlay from './src/components/TourOverlay';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

const NAV_OPTS = {
  headerStyle: { backgroundColor: '#0A0A14' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700', fontSize: 17 },
  headerShadowVisible: false,
  gestureEnabled: true,
};

// ── Tab icon components (no emoji) ─────────────────────────────────────────

function HomeIcon({ focused }) {
  const c = focused ? '#6C63FF' : '#8E8E93';
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ alignItems: 'center', justifyContent: 'flex-end', height: 20 }}>
        <View style={{
          width: 0, height: 0,
          borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 7,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderBottomColor: c,
        }} />
        <View style={{ width: 14, height: 10, backgroundColor: c, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }}>
          <View style={{ width: 4, height: 6, backgroundColor: focused ? '#EEF0FF' : '#E5E5EA', borderRadius: 1, alignSelf: 'center', marginTop: 4 }} />
        </View>
      </View>
      <Text style={{ fontSize: 8, fontWeight: '600', color: c }} numberOfLines={1} adjustsFontSizeToFit>Today</Text>
    </View>
  );
}

function ScanIcon({ focused }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: '#6C63FF',
        alignItems: 'center', justifyContent: 'center',
        marginTop: -6,
        shadowColor: '#6C63FF', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      }}>
        <View style={{ width: 15, height: 12, borderRadius: 3, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 5.5, height: 5.5, borderRadius: 2.75, borderWidth: 1.5, borderColor: '#fff' }} />
        </View>
      </View>
      <Text style={{ fontSize: 8, fontWeight: '700', color: '#6C63FF' }} numberOfLines={1} adjustsFontSizeToFit>Scan</Text>
    </View>
  );
}

function HistoryIcon({ focused }) {
  const c = focused ? '#6C63FF' : '#8E8E93';
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ gap: 3.5 }}>
        {[18, 14, 18].map((w, i) => (
          <View key={i} style={{ width: w, height: 2, backgroundColor: c, borderRadius: 1 }} />
        ))}
      </View>
      <Text style={{ fontSize: 8, fontWeight: '600', color: c }} numberOfLines={1} adjustsFontSizeToFit>History</Text>
    </View>
  );
}

function InsightsIcon({ focused }) {
  const c = focused ? '#6C63FF' : '#8E8E93';
  const bars = [10, 16, 12, 18];
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 2.5, alignItems: 'flex-end', height: 18 }}>
        {bars.map((h, i) => (
          <View key={i} style={{ width: 3.5, height: h, backgroundColor: i === 3 && focused ? '#6C63FF' : c, borderRadius: 1, opacity: focused ? 1 : 0.9 }} />
        ))}
      </View>
      <Text style={{ fontSize: 8, fontWeight: '600', color: c }} numberOfLines={1} adjustsFontSizeToFit>Insights</Text>
    </View>
  );
}

function MoreIcon({ focused }) {
  const c = focused ? '#6C63FF' : '#8E8E93';
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        {[1, 1.4, 1].map((scale, i) => (
          <View key={i} style={{ width: 4 * scale, height: 4 * scale, borderRadius: 2 * scale, backgroundColor: c }} />
        ))}
      </View>
      <Text style={{ fontSize: 8, fontWeight: '600', color: c }} numberOfLines={1} adjustsFontSizeToFit>More</Text>
    </View>
  );
}

// ── Stacks ──────────────────────────────────────────────────────────────────

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={NAV_OPTS}>
      <Stack.Screen name="Home"       component={HomeScreen}       options={{ headerShown: false }} />
      <Stack.Screen name="MealDetail" component={MealDetailScreen} options={{ title: 'Meal Detail' }} />
    </Stack.Navigator>
  );
}

function HistoryStack() {
  return (
    <Stack.Navigator screenOptions={NAV_OPTS}>
      <Stack.Screen name="History"    component={HistoryScreen}    options={{ title: 'History' }} />
      <Stack.Screen name="MealDetail" component={MealDetailScreen} options={{ title: 'Meal Detail' }} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={NAV_OPTS}>
      <Stack.Screen name="MoreHome"    component={MoreScreen}        options={{ headerShown: false }} />
      <Stack.Screen name="Reports"     component={ReportScreen}      options={{ title: 'Blood Reports' }} />
      <Stack.Screen name="Suggestions" component={SuggestionsScreen} options={{ title: 'Meal Suggestions' }} />
      <Stack.Screen name="SafeFoods"   component={SafeFoodsScreen}   options={{ title: 'Safe Foods' }} />
      <Stack.Screen name="DoctorNotes"    component={DoctorNotesScreen}   options={{ title: 'Doctor Notes' }} />
      <Stack.Screen name="Settings"       component={SettingsScreen}      options={{ title: 'Settings' }} />
      <Stack.Screen name="Tools"          component={ToolsScreen}         options={{ title: 'Tools & Calculators' }} />
      <Stack.Screen name="AddReport"      component={AddReportScreen}     options={{ title: 'Add Report', ...NAV_OPTS }} />
      <Stack.Screen name="AddDoctorNote"  component={AddDoctorNoteScreen} options={{ title: 'New Note', ...NAV_OPTS }} />
    </Stack.Navigator>
  );
}

// ── Main tabs ────────────────────────────────────────────────────────────────

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
      <Tab.Navigator
        screenOptions={{
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 0.5,
            borderTopColor: '#E5E5EA',
            paddingTop: 8,
            paddingBottom: insets.bottom + 4,
            elevation: 16,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: -4 },
          },
          tabBarHideOnKeyboard: true,
          headerShown: false,
        }}
      >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ title: 'Today', tabBarIcon: ({ focused }) => <HomeIcon focused={focused} /> }}
      />
      <Tab.Screen
        name="CameraTab"
        component={CameraScreen}
        options={{
          title: 'Scan',
          headerShown: true,
          headerTitle: 'Scan Meal',
          ...NAV_OPTS,
          tabBarIcon: ({ focused }) => <ScanIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStack}
        options={{ title: 'History', tabBarIcon: ({ focused }) => <HistoryIcon focused={focused} /> }}
      />
      <Tab.Screen
        name="InsightsTab"
        component={InsightsScreen}
        options={{
          title: 'Insights',
          headerShown: true,
          headerTitle: 'Insights',
          ...NAV_OPTS,
          tabBarIcon: ({ focused }) => <InsightsIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStack}
        options={{ title: 'More', tabBarIcon: ({ focused }) => <MoreIcon focused={focused} /> }}
      />
      </Tab.Navigator>
  );
}

// ── App root — handles onboarding gate ──────────────────────────────────────

function AppContent() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { startTour } = useTour();

  useEffect(() => {
    isOnboardingComplete().then(done => {
      setShowOnboarding(!done);
      setReady(true);
    });
  }, []);

  const { isUpdatePending } = __DEV__ ? { isUpdatePending: false } : Updates.useUpdates();
  useEffect(() => {
    if (!isUpdatePending) return;
    Alert.alert(
      'Update Available',
      'A new version is ready. Restart now to get the latest features.',
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart Now', onPress: () => Updates.reloadAsync() },
      ]
    );
  }, [isUpdatePending]);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: '#0A0A14' }} />;
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen
        onComplete={() => {
          setShowOnboarding(false);
          // Start the interactive tour after main UI mounts
          setTimeout(() => startTour(), 900);
        }}
      />
    );
  }

  return <MainTabs />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer ref={navigationRef}>
        <TourProvider navigationRef={navigationRef}>
          <AppContent />
          <TourOverlay />
        </TourProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
