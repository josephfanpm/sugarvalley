// Applies the saved theme before first paint (no flash). 'system' follows the OS.
(function () {
  var t = 'system';
  try { t = localStorage.getItem('sp-theme') || 'system'; } catch (e) {}
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
})();
