import AsyncStorage from '@react-native-async-storage/async-storage';

const MEALS_KEY = 'meals_log';

export async function saveMeal(meal) {
  const existing = await getMeals();
  const updated = [meal, ...existing];
  await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(updated));
}

export async function getMeals() {
  const raw = await AsyncStorage.getItem(MEALS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getTodaysMeals() {
  const meals = await getMeals();
  const today = new Date().toDateString();
  return meals.filter(m => new Date(m.timestamp).toDateString() === today);
}

export async function deleteMeal(id) {
  const meals = await getMeals();
  await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(meals.filter(m => m.id !== id)));
}

export function calcDailyTotals(meals) {
  return meals.reduce(
    (acc, m) => {
      const n = m.analysis?.nutrients || {};
      acc.saturatedFat += n.saturatedFat || 0;
      acc.transFat += n.transFat || 0;
      acc.cholesterol += n.cholesterol || 0;
      acc.sugar += n.sugar || 0;
      acc.fiber += n.fiber || 0;
      acc.omega3 += n.omega3 || 0;
      acc.protein += n.protein || 0;
      return acc;
    },
    { saturatedFat: 0, transFat: 0, cholesterol: 0, sugar: 0, fiber: 0, omega3: 0, protein: 0 }
  );
}
