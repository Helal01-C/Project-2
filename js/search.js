function matchesSearch(recipe, query) {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return true;
    const text = [
      recipe.name,
      recipe.description,
      recipe.category,
      recipe.cuisine,
      ...recipe.ingredients.map(ingredient => ingredient.name),
    ].join(' ').toLowerCase();
    return text.includes(normalizedQuery);
}
