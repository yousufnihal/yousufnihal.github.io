// Runs before first paint so animated content never flashes in its final state.
(function () {
    var root = document.documentElement;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var introSeen = false;

    try {
        introSeen = sessionStorage.getItem('intro-seen') === '1';
    } catch (e) {
        introSeen = false;
    }

    root.classList.add('js');
    if (!reduced) root.classList.add('motion');
    if (reduced || introSeen) root.classList.add('no-intro');

    // Failsafe: if script.js never runs, show everything instead of a blank page
    setTimeout(function () {
        if (!root.classList.contains('ready')) {
            root.classList.remove('motion');
            root.classList.add('ready', 'no-intro');
        }
    }, 4000);
})();
