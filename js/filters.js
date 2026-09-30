function filterRecipes(list, filters) {
    return list.filter(recipe => {
        const proteinMatches = !filters.protein || recipe.category === filters.protein;
        const cuisineMatches = !filters.cuisine || recipe.cuisine === filters.cuisine;
        const difficultyMatches = !filters.difficulty || recipe.difficulty === filters.difficulty;
        const timeMatches = !filters.time
          || (filters.time === 'under30' && recipe.totalTime < 30)
          || (filters.time === '30to60' && recipe.totalTime >= 30 && recipe.totalTime <= 60)
          || (filters.time === 'over60' && recipe.totalTime > 60);
        return proteinMatches && cuisineMatches && difficultyMatches && timeMatches;
  });
}
function sortRecipes(list, sort) {
    return [...list].sort((first, second) => {
        if (sort === 'fast') return first.totalTime - second.totalTime;
        if (sort === 'alpha') return first.name.localeCompare(second.name);
        if (sort === 'new') return second.id - first.id;
        if (sort === 'popular') return second.popularity - first.popularity;
        return second.rating - first.rating;
  });
}
