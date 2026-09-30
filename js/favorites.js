const FAVORITES_KEY = 'My Kitchen-favorites';
let favoriteIds = readStore(FAVORITES_KEY);

function readStore(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
  } catch {
    // Local storage is only the offline fallback and cache.
  }
}

function setFavorites(ids) {
  favoriteIds = [...new Set(ids.map(Number).filter(Number.isFinite))];
  saveFavorites();
  return favoriteIds;
}

function favorites() {
  return favoriteIds;
}

function isFavorite(id) {
  return favoriteIds.includes(Number(id));
}

async function loadFavorites() {
  if (!window.MyKitchenApi) return favoriteIds;
  try {
    return setFavorites(await window.MyKitchenApi.getFavorites());
  } catch {
    return favoriteIds;
  }
}

async function toggleFavorite(id) {
  const recipeId = Number(id);
  const adding = !isFavorite(recipeId);
  setFavorites(adding
    ? [...favoriteIds, recipeId]
    : favoriteIds.filter(item => item !== recipeId));

  if (!window.MyKitchenApi) return isFavorite(recipeId);
  try {
    const saved = adding
      ? await window.MyKitchenApi.addFavorite(recipeId)
      : await window.MyKitchenApi.removeFavorite(recipeId);
    setFavorites(saved);
  } catch {
    // Keep the optimistic local value so the UI remains useful offline.
  }
  return isFavorite(recipeId);
}
