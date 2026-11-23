// ==UserScript==
// @name         Prologistics – Języki wiadomości w tickecie (RMA)
// @namespace    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts
// @version      1.0.0
// @description  Rozpoznaje język wiadomości (czerwonych i zielonych) w tickecie RMA i pokazuje podsumowanie języków
// @author       kimrioter
// @match        https://www.prologistics.info/rma.php*
// @match        https://prologistics.info/rma.php*
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-message-languages.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-message-languages.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';
    const BRAND = '#750000';

    // Kolory wierszy z wiadomościami (z HTML strony ticketa)
    const COLOR_RED = 'rgb(255, 89, 89)';     // wiadomość od klienta
    const COLOR_GREEN = 'rgb(184, 221, 186)'; // wiadomość wysłana do klienta

    // Automatyczne wiadomości systemowe (można je wykluczyć z podsumowania checkboxem)
    const SYSTEM_PATTERNS = [
        /^the files were sent to customer/i,
    ];

    // ------------------------------------------------------------------
    // Języki: nazwa, flaga, najczęstsze słowa i charakterystyczne znaki
    // ------------------------------------------------------------------
    const LANGS = {
        en: { name: 'Angielski', flag: '🇬🇧',
            words: 'the and is are was were to of in for on with that this it you your we our have has be not please can will would from at as an or but order item thank thanks hello regards dear been which there they',
            chars: null },
        de: { name: 'Niemiecki', flag: '🇩🇪',
            words: 'und der die das ist nicht ich sie wir mit für auf ein eine einen den dem des zu von bitte danke hallo uns ihr ihre haben wurde bei auch noch aber oder wie sehr können ware bestellung leider freundlichen grüßen sehr geehrte',
            chars: /[äöüß]/g },
        fr: { name: 'Francuski', flag: '🇫🇷',
            words: 'le la les et est une des pour pas que qui dans avec nous vous sur ce cette mais être avons bonjour merci votre notre commande ne je il elle au aux du cordialement madame monsieur',
            chars: /[éèêàçœù]/g },
        it: { name: 'Włoski', flag: '🇮🇹',
            words: 'il lo gli e è un una per non che di da con sono nel della del ci vi ma questo questa grazie buongiorno ordine abbiamo siamo anche come cordiali saluti gentile',
            chars: /[àèìòù]/g },
        es: { name: 'Hiszpański', flag: '🇪🇸',
            words: 'el los las y es un una por para no que de con en del al se su sus pero muy gracias hola pedido estamos hemos usted está saludos estimado',
            chars: /[ñ¿¡áíóú]/g },
        pt: { name: 'Portugalski', flag: '🇵🇹',
            words: 'o os as e é um uma para não que de do da dos das com em no na por mas muito obrigado obrigada olá encomenda estão pelo pela foi são ao artigo cumprimentos solicitamos',
            chars: /[ãõçâêô]/g },
        nl: { name: 'Niderlandzki', flag: '🇳🇱',
            words: 'de het een en is van in op met voor niet dat die wij u uw zijn hebben maar ook nog bij om bestelling bedankt graag ik we groet vriendelijke',
            chars: null },
        pl: { name: 'Polski', flag: '🇵🇱',
            words: 'i w na z do jest nie się że to jak co ale czy dla od po przez są być mamy pan pani dzień dobry dziękuję zamówienie oraz jestem pozdrawiam',
            chars: /[ąęłśźżćń]/g },
        cs: { name: 'Czeski', flag: '🇨🇿',
            words: 'a je se na v z do že to jak ale pro od jsou být jsem děkuji dobrý den objednávka prosím který také již bylo pozdravem',
            chars: /[řěů]/g },
        sk: { name: 'Słowacki', flag: '🇸🇰',
            words: 'a je sa na v z do že to ako ale pre od sú byť som ďakujem dobrý deň objednávka prosím ktorý tiež už bolo pozdravom',
            chars: /[ľĺŕôä]/g },
        sv: { name: 'Szwedzki', flag: '🇸🇪',
            words: 'och är att det som en ett på för med inte jag vi ni har till av den om men hej tack beställning kan vara hälsningar',
            chars: /[åäö]/g },
        da: { name: 'Duński', flag: '🇩🇰',
            words: 'og er at det som en et på for med ikke jeg vi har til af den om men hej tak bestilling kan være hilsen venlig',
            chars: /[æøå]/g },
        no: { name: 'Norweski', flag: '🇳🇴',
            words: 'og er at det som en et på for med ikke jeg vi har til av den om men hei takk bestilling kan være hilsen vennlig',
            chars: /[æøå]/g },
        fi: { name: 'Fiński', flag: '🇫🇮',
            words: 'ja on ei se että olen olemme te me tilaus kiitos hei mutta kun myös tai voi ole oli terveisin ystävällisin',
            chars: /[äö]/g },
        hu: { name: 'Węgierski', flag: '🇭🇺',
            words: 'és a az egy hogy nem van is meg de ez azt köszönöm kérem rendelés vagyok már még üdvözlettel',
            chars: /[őűáé]/g },
        ro: { name: 'Rumuński', flag: '🇷🇴',
            words: 'și este în la un o cu nu pentru că de pe se ce mai sunt vă mulțumesc comanda bună ziua',
            chars: /[ășțâî]/g },
        el: { name: 'Grecki', flag: '🇬🇷', words: '', chars: null },
    };

    const UNKNOWN = { name: 'Nieznany', flag: '❔' };

    // Zbiory słów do szybkiego sprawdzania
    for (const code of Object.keys(LANGS)) {
        LANGS[code].set = new Set(LANGS[code].words.split(/\s+/).filter(Boolean));
    }

    // ------------------------------------------------------------------
    // Rozpoznawanie języka (heurystyka offline)
    // ------------------------------------------------------------------
    function cleanText(text) {
        return text
            .replace(/https?:\/\/\S+/gi, ' ')
            .replace(/\S+@\S+\.\S+/g, ' ')
            .replace(/\S+\.(pdf|jpe?g|png|docx?|xlsx?)\b/gi, ' ')
            .replace(/#?\d[\d\s\-\/.]*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function detectHeuristic(rawText) {
        const text = cleanText(rawText).toLowerCase();
        if (!text) return { code: null, confidence: 0 };

        // Alfabet grecki
        if ((text.match(/[Ͱ-Ͽ]/g) || []).length > 5) return { code: 'el', confidence: 1 };

        const tokens = text.match(/\p{L}+/gu) || [];
        if (tokens.length === 0) return { code: null, confidence: 0 };

        const scores = {};
        for (const [code, lang] of Object.entries(LANGS)) {
            let s = 0;
            for (const t of tokens) if (lang.set.has(t)) s += 1;
            if (lang.chars) {
                const n = (text.match(lang.chars) || []).length;
                s += Math.min(n, 6) * 0.5;
            }
            scores[code] = s;
        }

        // Rozróżnienia bliskich języków
        if (/[ä]/.test(text) && /[å]/.test(text)) scores.sv += 2;
        if (/[æø]/.test(text)) { scores.sv -= 1; scores.fi -= 2; }
        if (/[ß]/.test(text)) scores.de += 2;
        if (/[ãõ]/.test(text)) scores.pt += 2;
        if (/[ñ]/.test(text)) scores.es += 2;
        if (/[řěů]/.test(text)) scores.cs += 2;
        if (/[ľĺŕ]/.test(text)) scores.sk += 2;
        if (/[łąę]/.test(text)) scores.pl += 2;
        if (/[őű]/.test(text)) scores.hu += 2;
        if (/[șțş]/.test(text)) scores.ro += 2;

        const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const [bestCode, bestScore] = ranked[0];
        const second = ranked[1] ? ranked[1][1] : 0;

        if (bestScore < 1) return { code: null, confidence: 0 };
        const confidence = Math.min(1, (bestScore - second + 1) / (bestScore + 1));
        return { code: bestCode, confidence };
    }

    // Wbudowany detektor Chrome (jeśli dostępny) – dokładniejszy, używany jako pierwszy
    let chromeDetector = null;
    async function initChromeDetector() {
        try {
            if (!('LanguageDetector' in window)) return;
            const availability = await window.LanguageDetector.availability();
            if (availability !== 'available') return;
            chromeDetector = await window.LanguageDetector.create();
            console.log(LOG, 'Używam wbudowanego LanguageDetector z Chrome');
        } catch (e) {
            chromeDetector = null;
        }
    }

    async function detectLanguage(rawText) {
        const text = cleanText(rawText);
        if (chromeDetector && text.length >= 15) {
            try {
                const res = await chromeDetector.detect(text);
                if (res && res[0] && res[0].confidence >= 0.6 && res[0].detectedLanguage !== 'und') {
                    let code = res[0].detectedLanguage.split('-')[0];
                    if (code === 'nb' || code === 'nn') code = 'no';
                    return { code, confidence: res[0].confidence };
                }
            } catch (e) { /* fallback poniżej */ }
        }
        return detectHeuristic(rawText);
    }

    function langInfo(code) {
        if (!code) return UNKNOWN;
        return LANGS[code] || { name: code.toUpperCase(), flag: '🏳️' };
    }

    // ------------------------------------------------------------------
    // Zbieranie wiadomości
    // ------------------------------------------------------------------
    function normalizeColor(c) {
        return (c || '').replace(/\s+/g, '').toLowerCase();
    }

    function messageType(td) {
        const bg = normalizeColor(td.style.backgroundColor || getComputedStyle(td).backgroundColor);
        if (bg === normalizeColor(COLOR_RED)) return 'red';
        if (bg === normalizeColor(COLOR_GREEN)) return 'green';
        return null;
    }

    function collectMessages() {
        const out = [];
        document.querySelectorAll('span.commentText').forEach(span => {
            const td = span.closest('td');
            if (!td) return;
            const type = messageType(td);
            if (!type) return;
            const text = (span.innerText || span.textContent || '').trim();
            if (!text) return;
            const isSystem = SYSTEM_PATTERNS.some(p => p.test(text));
            out.push({ span, td, type, text, isSystem });
        });
        return out;
    }

    // ------------------------------------------------------------------
    // UI: znaczki przy wiadomościach + panel podsumowania
    // ------------------------------------------------------------------
    const STORAGE_KEY = 'tm-kimrioter-rma-lang-settings';
    let settings = { collapsed: false, includeSystem: true };
    try { Object.assign(settings, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch (e) { /* brak */ }
    const saveSettings = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* brak */ } };

    function injectStyles() {
        if (document.getElementById('tm-rma-lang-style')) return;
        const style = document.createElement('style');
        style.id = 'tm-rma-lang-style';
        style.textContent = `
            .tm-lang-badge { display:inline-block; margin:0 0 4px 0; padding:1px 6px; border-radius:10px;
                font:bold 11px/16px Arial,sans-serif; background:#fff; color:${BRAND}; border:1px solid ${BRAND}; }
            .tm-lang-badge.tm-system { opacity:.6; border-style:dashed; }
            .tm-lang-hl { outline:3px solid ${BRAND} !important; outline-offset:-3px; }
            #tm-rma-lang-panel { position:fixed; right:16px; bottom:16px; z-index:99999; width:290px;
                background:#fff; border:2px solid ${BRAND}; border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,.25);
                font:12px Arial,sans-serif; color:#222; }
            #tm-rma-lang-panel .tm-head { background:${BRAND}; color:#fff; padding:6px 10px; cursor:pointer;
                display:flex; justify-content:space-between; align-items:center; font-weight:bold; border-radius:5px 5px 0 0; }
            #tm-rma-lang-panel .tm-body { padding:8px 10px; max-height:50vh; overflow:auto; }
            #tm-rma-lang-panel table { width:100%; border-collapse:collapse; }
            #tm-rma-lang-panel th, #tm-rma-lang-panel td { padding:3px 4px; text-align:center; border-bottom:1px solid #eee; }
            #tm-rma-lang-panel th:first-child, #tm-rma-lang-panel td:first-child { text-align:left; }
            #tm-rma-lang-panel tbody tr { cursor:pointer; }
            #tm-rma-lang-panel tbody tr:hover, #tm-rma-lang-panel tbody tr.tm-active { background:#f6e6e6; }
            #tm-rma-lang-panel .tm-main { margin-bottom:6px; padding:5px; background:#f6e6e6; border-radius:4px; }
            #tm-rma-lang-panel .tm-foot { margin-top:6px; color:#666; font-size:11px; }
            #tm-rma-lang-panel label { cursor:pointer; }
        `;
        document.head.appendChild(style);
    }

    function setBadge(msg, result) {
        let badge = msg.td.querySelector(':scope > .tm-lang-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'tm-lang-badge';
            msg.td.insertBefore(badge, msg.td.firstChild);
        }
        const info = langInfo(result.code);
        badge.textContent = `${info.flag} ${result.code ? result.code.toUpperCase() : '?'}`
            + (msg.isSystem ? ' · systemowa' : '');
        badge.title = `${info.name} (pewność ${Math.round(result.confidence * 100)}%)`;
        badge.classList.toggle('tm-system', msg.isSystem);
    }

    let activeLang = null;

    function highlight(code, messages) {
        document.querySelectorAll('.tm-lang-hl').forEach(el => el.classList.remove('tm-lang-hl'));
        if (activeLang === code) { activeLang = null; return; }
        activeLang = code;
        const matching = messages.filter(m => (m.lang || 'unknown') === code);
        matching.forEach(m => m.td.classList.add('tm-lang-hl'));
        if (matching[0]) matching[0].td.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function renderPanel(messages) {
        let panel = document.getElementById('tm-rma-lang-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'tm-rma-lang-panel';
            document.body.appendChild(panel);
        }

        const counted = messages.filter(m => settings.includeSystem || !m.isSystem);
        const stats = {};
        for (const m of counted) {
            const key = m.lang || 'unknown';
            stats[key] = stats[key] || { red: 0, green: 0 };
            stats[key][m.type] += 1;
        }
        const rows = Object.entries(stats).sort((a, b) => (b[1].red + b[1].green) - (a[1].red + a[1].green));

        // Główny język klienta = najczęstszy język w czerwonych wiadomościach
        const redRows = rows.filter(([k, v]) => k !== 'unknown' && v.red > 0).sort((a, b) => b[1].red - a[1].red);
        const mainCode = redRows[0] ? redRows[0][0] : null;
        const mainInfo = langInfo(mainCode);
        const languagesUsed = rows.filter(([k]) => k !== 'unknown').length;

        const totalRed = counted.filter(m => m.type === 'red').length;
        const totalGreen = counted.filter(m => m.type === 'green').length;

        panel.innerHTML = `
            <div class="tm-head"><span>🌐 Języki wiadomości (${counted.length})</span><span>${settings.collapsed ? '▲' : '▼'}</span></div>
            <div class="tm-body" style="display:${settings.collapsed ? 'none' : 'block'}">
                <div class="tm-main">
                    Język klienta: <b>${mainCode ? `${mainInfo.flag} ${mainInfo.name}` : '—'}</b><br>
                    Liczba języków w tickecie: <b>${languagesUsed}</b>
                </div>
                <table>
                    <thead><tr><th>Język</th><th title="Wiadomości od klienta">🔴</th><th title="Wiadomości do klienta">🟢</th><th>Razem</th></tr></thead>
                    <tbody>
                        ${rows.map(([code, v]) => {
                            const info = code === 'unknown' ? UNKNOWN : langInfo(code);
                            return `<tr data-lang="${code}" class="${activeLang === code ? 'tm-active' : ''}">
                                <td>${info.flag} ${info.name}</td><td>${v.red}</td><td>${v.green}</td><td><b>${v.red + v.green}</b></td></tr>`;
                        }).join('') || '<tr><td colspan="4">Brak wiadomości</td></tr>'}
                    </tbody>
                    <tfoot><tr><th>Razem</th><th>${totalRed}</th><th>${totalGreen}</th><th>${counted.length}</th></tr></tfoot>
                </table>
                <div class="tm-foot">
                    <label><input type="checkbox" class="tm-sys" ${settings.includeSystem ? 'checked' : ''}> Uwzględnij wiadomości systemowe</label><br>
                    Kliknij język, aby podświetlić jego wiadomości.
                </div>
            </div>`;

        panel.querySelector('.tm-head').onclick = () => {
            settings.collapsed = !settings.collapsed;
            saveSettings();
            renderPanel(messages);
        };
        const sys = panel.querySelector('.tm-sys');
        if (sys) sys.onchange = () => {
            settings.includeSystem = sys.checked;
            saveSettings();
            renderPanel(messages);
        };
        panel.querySelectorAll('tbody tr[data-lang]').forEach(tr => {
            tr.onclick = () => { highlight(tr.dataset.lang, counted); renderPanel(messages); };
        });
    }

    // ------------------------------------------------------------------
    // Główna pętla + MutationObserver (odświeżanie przy zmianie treści)
    // ------------------------------------------------------------------
    const cache = new Map(); // tekst -> wynik rozpoznania
    let lastSignature = '';
    let running = false;

    async function run() {
        if (running) return;
        running = true;
        try {
            const messages = collectMessages();
            const signature = messages.map(m => m.type + ':' + m.text.length + ':' + m.text.slice(0, 30)).join('|');
            if (signature === lastSignature && document.getElementById('tm-rma-lang-panel')) return;
            lastSignature = signature;

            for (const m of messages) {
                let res = cache.get(m.text);
                if (!res) {
                    res = await detectLanguage(m.text);
                    cache.set(m.text, res);
                }
                m.lang = res.code;
                setBadge(m, res);
            }
            renderPanel(messages);
            console.log(LOG, `Przeanalizowano ${messages.length} wiadomości`);
        } finally {
            running = false;
        }
    }

    let debounce = null;
    function schedule() {
        clearTimeout(debounce);
        debounce = setTimeout(run, 400);
    }

    async function init() {
        injectStyles();
        await initChromeDetector();
        await run();
        new MutationObserver(mutations => {
            // Ignoruj zmiany wywołane przez sam skrypt
            const relevant = mutations.some(mu => {
                const t = mu.target;
                return !(t.closest && (t.closest('#tm-rma-lang-panel') || t.classList?.contains('tm-lang-badge')))
                    && ![...mu.addedNodes].every(n => n.classList?.contains('tm-lang-badge') || n.id === 'tm-rma-lang-panel');
            });
            if (relevant) schedule();
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    init();
})();
