import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tour_done_v1';

export async function isTourComplete() {
  return (await AsyncStorage.getItem(KEY)) === 'true';
}

export async function markTourComplete() {
  await AsyncStorage.setItem(KEY, 'true');
}

export async function resetTour() {
  await AsyncStorage.removeItem(KEY);
}
