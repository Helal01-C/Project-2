const fallbackImage = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80';
function imageFallback(img) {
   img.onerror = null;
   img.src = fallbackImage;
}
document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    document.querySelector('#site-header').innerHTML = `<header class="site-header"><nav class="nav wrap"><a class="brand" href="index.html">🍽️ My Kitchen</a><button class="nav-toggle" aria-label="Open navigation" aria-expanded="false">☰</button><div class="nav-links"><a class="${page === 'home' ? 'active' : ''}" href="index.html">Home</a><a class="${page === 'recipes' || page === 'recipe' ? 'active' : ''}" href="recipes.html">Dinner Recipes</a><a class="${page === 'categories' ? 'active' : ''}" href="weekly.html">Categories</a><a class="${page === 'favorites' ? 'active' : ''}" href="favorites.html">Favorites</a><a class="${page === 'about' ? 'active' : ''}" href="shopping.html">About</a></div></nav></header>`;
    document.querySelector('#site-footer').innerHTML = `<footer class="site-footer"><div class="wrap"><div class="footer-grid"><div><a class="brand" href="index.html">🍽️ My Kitchen</a><p>Thoughtful dinner recipes for every evening.</p></div><div><b>Explore</b><a href="recipes.html">Dinner Recipes</a><a href="weekly.html">Categories</a><a href="favorites.html">Favorites</a></div><div><b>About</b><a href="shopping.html">Our story</a><a href="mailto:hello@mykitchen.example">Contact</a></div></div><p class="copyright">© 2026 My Kitchen. Made for delicious dinners.</p></div></footer>`;
    const toggle = document.querySelector('.nav-toggle');
   const links = document.querySelector('.nav-links');
    toggle.onclick = () => {
     links.classList.toggle('open');
     toggle.setAttribute('aria-expanded', String(links.classList.contains('open')));
  };
});
