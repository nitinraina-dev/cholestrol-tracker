import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'onboarding_done_v1';

export async function isOnboardingComplete() {
  const val = await AsyncStorage.getItem(KEY);
  return val === 'true';
}

export async function markOnboardingComplete() {
  await AsyncStorage.setItem(KEY, 'true');
}
