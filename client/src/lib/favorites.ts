import { apiRequest } from './queryClient';

const MEAL_FAV_KEY = 'meal_favorites';
const REST_FAV_KEY = 'restaurant_favorites';

export function getLocalMealFavorites(): string[] {
  try {
    const raw = localStorage.getItem(MEAL_FAV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : Array.from(parsed || []);
  } catch {
    return [];
  }
}

export function isLocalMealFavorite(itemId: string): boolean {
  const favs = getLocalMealFavorites();
  return favs.includes(itemId);
}

export function saveLocalMealFavorites(list: string[]) {
  try {
    localStorage.setItem(MEAL_FAV_KEY, JSON.stringify(Array.from(new Set(list))));
  } catch (_) {}
}

export function toggleLocalMealFavorite(itemId: string): boolean {
  const list = getLocalMealFavorites();
  const index = list.indexOf(itemId);
  let isFav = false;
  if (index >= 0) {
    list.splice(index, 1);
    isFav = false;
  } else {
    list.push(itemId);
    isFav = true;
  }
  saveLocalMealFavorites(list);
  return isFav;
}

export async function toggleMealFavoriteWithApi(itemId: string, userId?: string): Promise<boolean> {
  const isFav = toggleLocalMealFavorite(itemId);
  if (userId) {
    try {
      if (isFav) {
        await apiRequest('POST', '/api/favorites', { userId, menuItemId: itemId });
      } else {
        await apiRequest('DELETE', `/api/favorites?userId=${userId}&menuItemId=${itemId}`);
      }
    } catch (err) {
      console.error('Failed to sync favorite with API:', err);
    }
  }
  return isFav;
}

export async function syncLocalFavoritesToApi(userId: string) {
  if (!userId) return;
  const localFavs = getLocalMealFavorites();
  if (localFavs.length === 0) return;
  
  for (const itemId of localFavs) {
    try {
      await apiRequest('POST', '/api/favorites', { userId, menuItemId: itemId });
    } catch (_) {
      // Ignore duplicate entries
    }
  }
}
