import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'blood_test_reminder_date';

export async function setTestReminder(dateString) {
  await AsyncStorage.setItem(KEY, dateString);
}

export async function getTestReminder() {
  return AsyncStorage.getItem(KEY);
}

export async function clearTestReminder() {
  await AsyncStorage.removeItem(KEY);
}
