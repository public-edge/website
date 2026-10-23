// Runs synchronously in <head>: paint the stored theme first, then register this
// open-source project with the shared RE8CH navigator before it renders.
(function () {
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem('re8ch-product-theme'); } catch (error) { stored = null; }
  var dark = stored === 'dark' || ((stored === null || stored === 'auto' || stored === 'system') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';

  var script = document.currentScript;
  var site = root.dataset.site;
  var products = {
    advfab: { label: 'AdvFab', color: '#0d9488' },
    'public-edge': { label: 'Public Edge', color: '#e0700b' },
    'among-clusters': { label: 'Among Clusters', color: '#6d5dfc' }
  };
  var product = products[site];
  if (!product || !script) return;
  var siteRoot = new URL('./', script.src);
  product.icon = new URL('mark.svg', siteRoot).href;
  product.href = siteRoot.href;
  var config = window.RE8CH_NAVIGATOR_CONFIG = window.RE8CH_NAVIGATOR_CONFIG || {};
  config.products = config.products || {};
  config.products[site] = product;
})();
