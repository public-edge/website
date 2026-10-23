// Shared behaviour for the open-source sites: copy buttons and footer theme sync.
(function () {
  document.querySelectorAll('[data-copy-target]').forEach(function (button) {
    button.addEventListener('click', function () {
      var target = document.getElementById(button.dataset.copyTarget);
      if (!target || !navigator.clipboard) return;
      navigator.clipboard.writeText(target.textContent.trim()).then(function () {
        var label = button.textContent;
        button.textContent = button.dataset.copied || 'Copied';
        setTimeout(function () { button.textContent = label; }, 1400);
      }).catch(function () {});
    });
  });

  // The navigator owns the theme control; mirror its result onto the footer.
  var root = document.documentElement;
  function syncFooter() {
    document.querySelectorAll('re8ch-footer').forEach(function (footer) {
      if (footer.getAttribute('theme') !== root.dataset.theme) footer.setAttribute('theme', root.dataset.theme || 'light');
    });
  }
  new MutationObserver(syncFooter).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  syncFooter();
})();
