import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  STREAK: 'streak_data',
  BADGES: 'badges_earned',
};

const ALL_BADGES = [
  { id: 'first_scan',    icon: '🔬', title: 'First Scan',       desc: 'Analyzed your first meal' },
  { id: 'green_day',     icon: '🌿', title: 'Green Day',        desc: 'Avg risk under 3 for a day' },
  { id: 'streak_3',      icon: '🔥', title: '3-Day Streak',     desc: '3 days of low-risk eating' },
  { id: 'streak_7',      icon: '🏆', title: 'Week Champion',    desc: '7 days of low-risk eating' },
  { id: 'streak_30',     icon: '💎', title: 'Month Master',     desc: '30 days of low-risk eating' },
  { id: 'fiber_champ',   icon: '🌾', title: 'Fiber Champion',   desc: 'Hit fiber goal 5 days' },
  { id: 'report_added',  icon: '🧬', title: 'Blood Aware',      desc: 'Added your first blood report' },
  { id: 'ten_meals',     icon: '🍽️', title: 'Consistent',       desc: 'Logged 10 meals total' },
  { id: 'safe_finder',   icon: '✅', title: 'Safe Finder',      desc: 'Found 5 safe foods' },
];

export async function getStreakData() {
  const raw = await AsyncStorage.getItem(KEYS.STREAK);
  if (!raw) return { current: 0, best: 0, lastDate: null, lowRiskDays: [], streakBefore: 0 };
  const data = JSON.parse(raw);
  if (data.streakBefore == null) data.streakBefore = 0;
  return data;
}

export async function updateStreak(dateString, avgRisk) {
  const data = await getStreakData();
  const today = dateString || new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  // On each new day, snapshot the streak so same-day re-evaluations work correctly.
  // E.g. first meal is bad (resets to 0), later meals make avg good → streak recovers.
  if (data.lastDate !== today) {
    data.streakBefore = data.lastDate === yesterday ? data.current : 0;
    data.lastDate = today;
  }

  if (avgRisk <= 4) {
    data.current = (data.streakBefore || 0) + 1;
    if (!(data.lowRiskDays || []).includes(today)) {
      data.lowRiskDays = [...(data.lowRiskDays || []), today].slice(-60);
    }
  } else {
    data.current = 0;
    data.lowRiskDays = (data.lowRiskDays || []).filter(d => d !== today);
  }

  data.best = Math.max(data.best || 0, data.current);
  await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(data));
  return data;
}

export async function getEarnedBadges() {
  const raw = await AsyncStorage.getItem(KEYS.BADGES);
  return raw ? JSON.parse(raw) : [];
}

export async function awardBadge(badgeId) {
  const earned = await getEarnedBadges();
  if (earned.includes(badgeId)) return false;
  earned.push(badgeId);
  await AsyncStorage.setItem(KEYS.BADGES, JSON.stringify(earned));
  return true;
}

export async function checkAndAwardBadges({ totalMeals, streak, lowRiskDays, hasReport, safeFoodsCount, fiberDays }) {
  const newBadges = [];

  if (totalMeals >= 1) { if (await awardBadge('first_scan')) newBadges.push('first_scan'); }
  if (totalMeals >= 10) { if (await awardBadge('ten_meals')) newBadges.push('ten_meals'); }
  if (lowRiskDays >= 1) { if (await awardBadge('green_day')) newBadges.push('green_day'); }
  if (streak >= 3)  { if (await awardBadge('streak_3')) newBadges.push('streak_3'); }
  if (streak >= 7)  { if (await awardBadge('streak_7')) newBadges.push('streak_7'); }
  if (streak >= 30) { if (await awardBadge('streak_30')) newBadges.push('streak_30'); }
  if (hasReport)    { if (await awardBadge('report_added')) newBadges.push('report_added'); }
  if (safeFoodsCount >= 5) { if (await awardBadge('safe_finder')) newBadges.push('safe_finder'); }
  if (fiberDays >= 5) { if (await awardBadge('fiber_champ')) newBadges.push('fiber_champ'); }

  return newBadges;
}

export function getAllBadges() { return ALL_BADGES; }
export function getBadgeById(id) { return ALL_BADGES.find(b => b.id === id); }

export async function refreshBadges(allMeals, allReports) {
  const streakData = await getStreakData();
  const safeFoodsCount = allMeals.filter(m => m.analysis?.riskLevel === 'LOW' && m.analysis?.riskScore <= 3).length;
  const fiberMap = {};
  allMeals.forEach(m => {
    const d = new Date(m.timestamp).toDateString();
    fiberMap[d] = (fiberMap[d] || 0) + (m.analysis?.nutrients?.fiber || 0);
  });
  const fiberDays = Object.values(fiberMap).filter(v => v >= 25).length;
  return checkAndAwardBadges({
    totalMeals: allMeals.length,
    streak: streakData.current,
    lowRiskDays: (streakData.lowRiskDays || []).length,
    hasReport: allReports.length > 0,
    safeFoodsCount,
    fiberDays,
  });
}
