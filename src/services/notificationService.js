import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'notification_prefs';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getNotificationPrefs() {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  return raw ? JSON.parse(raw) : {
    waterReminders: false,
    waterInterval: 2,       // hours between reminders
    mealReminders: false,
    mealTimes: ['08:00', '13:00', '19:30'],
  };
}

export async function saveNotificationPrefs(prefs) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function scheduleWaterReminders(intervalHours) {
  await cancelWaterReminders();
  for (let h = 8; h <= 22; h += intervalHours) {
    await Notifications.scheduleNotificationAsync({
      identifier: `water_${h}`,
      content: {
        title: 'Hydration Reminder',
        body: 'Time to drink water. Staying hydrated supports cholesterol metabolism.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Math.floor(h),
        minute: 0,
        repeats: true,
      },
    });
  }
}

export async function cancelWaterReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if (n.identifier.startsWith('water_')) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function scheduleMealReminders(times) {
  await cancelMealReminders();
  for (const t of times) {
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    await Notifications.scheduleNotificationAsync({
      identifier: `meal_${t}`,
      content: {
        title: 'Log Your Meal',
        body: 'Scan or log what you just ate to track your cholesterol-friendly diet.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: h,
        minute: m,
        repeats: true,
      },
    });
  }
}

export async function cancelMealReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if (n.identifier.startsWith('meal_')) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}
