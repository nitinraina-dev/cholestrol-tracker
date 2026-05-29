import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'custom_foods';

// Custom food template: manually saved foods with known nutrients
export async function getCustomFoods() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveCustomFood(food) {
  const list = await getCustomFoods();
  const existing = list.findIndex(f => f.id === food.id);
  if (existing !== -1) {
    list[existing] = food;
  } else {
    list.unshift({ ...food, id: food.id || Date.now().toString(), createdAt: new Date().toISOString() });
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function deleteCustomFood(id) {
  const list = await getCustomFoods();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter(f => f.id !== id)));
}

// Convert a scanned meal into a custom food template
export function mealToCustomFood(meal) {
  return {
    id: Date.now().toString(),
    name: meal.analysis?.foods?.join(', ') || 'Unnamed Meal',
    servingNote: meal.analysis?.servingNote || '',
    nutrients: meal.analysis?.nutrients || {},
    riskScore: meal.analysis?.riskScore ?? null,
    canEat: meal.analysis?.canEat || 'IN MODERATION',
    imageUri: meal.imageUri || null,
    source: 'scan',
    createdAt: new Date().toISOString(),
  };
}
