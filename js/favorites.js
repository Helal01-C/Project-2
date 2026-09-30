function readStore(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
  }
   catch {
        return [];
  }
}
function favorites() {
    return readStore('My Kitchen-favorites');
}
function isFavorite(id) {
    return favorites().includes(id);
}
function toggleFavorite(id) {
    const current = favorites();
    const updated = current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id];
    localStorage.setItem('My Kitchen-favorites', JSON.stringify(updated));
    return updated.includes(id);
}
