// FyBlue tarayıcı yardımcıları (Blazor JS interop).
window.fyblue = (function () {
    const THEME_KEY = 'fyblue.theme';

    function safeGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function safeSet(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* depolama kapalı */ }
    }

    function isDark() {
        const explicit = document.documentElement.getAttribute('data-theme');
        if (explicit) return explicit === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    return {
        isDark: isDark,

        toggleTheme: function () {
            const next = isDark() ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            safeSet(THEME_KEY, next);
            return next === 'dark';
        },

        getFlag: function (name) {
            return safeGet('fyblue.' + name) === '1';
        },

        setFlag: function (name, value) {
            safeSet('fyblue.' + name, value ? '1' : '0');
        },

        scrollToTop: function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // Base64 içeriği dosya olarak indirir (CSV dışa aktarma).
        download: function (fileName, base64, mime) {
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    };
})();

// Firefox, dataTransfer'a veri yazılmadan sürüklemeyi başlatmaz; Blazor bunu
// yapamadığı için sürüklenebilir her öğeye boş bir veri eklenir.
document.addEventListener('dragstart', function (e) {
    try {
        if (e.dataTransfer && e.dataTransfer.types.length === 0) {
            e.dataTransfer.setData('text/plain', '');
            e.dataTransfer.effectAllowed = 'copyMove';
        }
    } catch (err) { /* yok say */ }
}, true);
