// ==UserScript==
// @name         Prologistics – Podsumowanie timerów (issue logs)
// @namespace    kimrioter
// @version      2.1.0
// @description  Zczytuje timery z komentarzem z logów zadania i podsumowuje czas z wybranego dnia (timery z komentarzem + dodane ręcznie, per komentarz)
// @author       kimrioter
// @match        https://www.prologistics.info/react/logs/issue_logs/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-timer-summary.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-timer-summary.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';
    const BRAND = '#750000';
    const PANEL_ID = 'tm-timer-summary';

    // Liczymy tylko wpisy z komentarzem:
    // 1) timer:   "... commented on ... spent time from A to B (hh:mm:ss) "komentarz""
    // 2) ręczny:  "... added manually spent time on RRRR-MM-DD GG:MM:SS (hh:mm:ss) "komentarz""
    // (wpisy "spent time on the task" bez komentarza są pomijane)
    const RE_TIMER = /^(.+?) commented on .+? spent time from (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) to (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \((\d+):(\d{2}):(\d{2})\) "([\s\S]*)"\s*$/;
    const RE_MANUAL = /^(.+?) added manually spent time on (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \((\d+):(\d{2}):(\d{2})\) "([\s\S]*)"\s*$/;

    const norm = el => el.textContent.replace(/\s+/g, ' ').trim();

    function parse(text) {
        let m = text.match(RE_TIMER);
        if (m) {
            return {
                manual: false, person: m[1].trim(), date: m[2], start: m[3], end: m[5],
                seconds: (+m[6]) * 3600 + (+m[7]) * 60 + (+m[8]),
                label: m[9].trim() || '(pusty komentarz)',
            };
        }
        m = text.match(RE_MANUAL);
        if (m) {
            return {
                manual: true, person: m[1].trim(), date: m[2], start: m[3], end: null,
                seconds: (+m[4]) * 3600 + (+m[5]) * 60 + (+m[6]),
                label: m[7].trim() || '(pusty komentarz)',
            };
        }
        return null;
    }

    const today = () => {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };

    // data w formacie DD.MM.RRRR (wewnętrznie trzymamy RRRR-MM-DD)
    const isoToPl = iso => iso.split('-').reverse().join('.');
    function plToIso(str) {
        const m = str.trim().match(/^(\d{1,2})[.\-\/ ](\d{1,2})[.\-\/ ](\d{4})$/);
        if (!m) return null;
        const d = +m[1], mo = +m[2], y = +m[3];
        const dt = new Date(y, mo - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
        const p = n => String(n).padStart(2, '0');
        return `${y}-${p(mo)}-${p(d)}`;
    }

    // zmniejsza czcionkę, aż tekst zmieści się w jednej linii (od 12 px do 8 px)
    function fitText(el, max = 11, min = 7.5) {
        let size = max;
        el.style.fontSize = size + 'px';
        if (!el.clientWidth) return;
        while (el.scrollWidth > el.clientWidth && size > min) {
            size -= 0.5;
            el.style.fontSize = size + 'px';
        }
    }

    const fmt = sec => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        const p = n => String(n).padStart(2, '0');
        return `${p(h)}:${p(m)}:${p(s)}`;
    };

    // minuty w nawiasie, np. "(30 min)", "(0.1 min)"
    const fmtMin = sec => {
        const m = (Math.round(sec / 60 * 10) / 10).toString();
        return `(${m} min)`;
    };
    const minVal = sec => (Math.round(sec / 60 * 10) / 10).toString();
    const fmtFull = sec => `${fmt(sec)} ${fmtMin(sec)}`;

    // klik w minuty -> kopiuje samą liczbę (np. "30.4") do schowka
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return Promise.resolve();
    }
    const minCell = (sec, extra = '') =>
        `<span class="tm-ts-min" data-copy="${minVal(sec)}" title="Kliknij, aby skopiować ${minVal(sec)}" ` +
        `style="cursor:pointer;border-bottom:1px dotted ${BRAND};${extra}">${fmtMin(sec)}</span>`;

    // ---------- skanowanie strony ----------
    // Niezależne od struktury HTML: szukamy węzłów tekstowych z "spent time" / "commented on" / "You see",
    // a potem wspinamy się do najmniejszego elementu, którego cały tekst jest pełnym wpisem logu.
    // (Szybkie: sprawdzamy tylko okolice trafień, a nie wszystkie elementy strony.)
    const NOTICE_RE = /You see (\d+) of (\d+) comments/;
    const HIT_RE = /spent\s+time|commented\s+on|added\s+manually|You\s+see/;

    function scan() {
        const panel = document.getElementById(PANEL_ID);
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const done = new Set();
        const found = [];
        let notice = null;
        let node;
        while ((node = walker.nextNode())) {
            const v = node.nodeValue;
            if (v.length > 2000 || !HIT_RE.test(v)) continue;
            let el = node.parentElement;
            if (!el || (panel && panel.contains(el))) continue;
            for (let depth = 0; el && depth < 5; depth++, el = el.parentElement) {
                if (done.has(el)) break;
                const text = norm(el);
                if (text.length > 700) break;
                const e = parse(text);
                if (e) { found.push(e); done.add(el); break; }
                const m = text.match(NOTICE_RE);
                if (m) { notice = notice || { el, shown: +m[1], total: +m[2] }; done.add(el); break; }
            }
        }
        // duplikaty usuwamy tylko dla timerów (ręczne wpisy nie mają godziny końca,
        // więc dwa takie same wpisy to dwa osobne wpisy)
        const seen = new Set();
        const entries = found.filter(e => {
            if (e.manual) return true;
            const k = [e.date, e.start, e.end, e.label].join('|');
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
        return { entries, notice };
    }

    // klik w "All comments" (link może być obok tekstu, więc szukamy też w kilku elementach nadrzędnych)
    function clickAll(notice) {
        let n = notice.el;
        for (let i = 0; n && i < 4; i++, n = n.parentElement) {
            const link = [...n.querySelectorAll('a, button, [role="button"], span, div')]
                .find(e => e.childElementCount === 0 && /^\s*all comments\s*$/i.test(e.textContent));
            if (link) { link.click(); console.log(LOG, 'Klik w "All comments"'); return; }
        }
        notice.el.click();
    }

    // ---------- UI ----------
    function build() {
        if (document.getElementById(PANEL_ID)) return;
        const box = document.createElement('div');
        box.id = PANEL_ID;
        box.style.cssText = `position:fixed;top:51px;right:96px;z-index:99999;width:340px;max-width:90vw;box-sizing:border-box;white-space:nowrap;
            overflow:hidden;background:#fff;border:2px solid ${BRAND};border-radius:10px;
            box-shadow:0 4px 16px rgba(0,0,0,.25);font:11px/1.4 Arial,sans-serif;color:#222;`;
        box.innerHTML = `
            <div id="tm-ts-head" style="background:${BRAND};color:#fff;padding:6px 10px;cursor:move;user-select:none;touch-action:none;font-size:12px;
                display:flex;justify-content:space-between;align-items:center;font-weight:bold;" title="Przeciągnij, aby przesunąć · kliknij, aby zwinąć">
                <span>⏱ Summary of Timers</span><span id="tm-ts-toggle">–</span>
            </div>
            <div id="tm-ts-body" style="padding:8px 10px;">
                <div style="margin-bottom:6px;display:flex;align-items:center;gap:4px;position:relative;">
                    <input type="text" id="tm-ts-date" maxlength="10" placeholder="DD.MM.RRRR" title="Dzień.miesiąc.rok"
                        style="width:80px;padding:1px 4px;font-size:11px;text-align:center;box-sizing:border-box;">
                    <button type="button" id="tm-ts-cal" title="Wybierz z kalendarza"
                        style="cursor:pointer;padding:0 4px;font-size:11px;">📆</button>
                    <input type="date" id="tm-ts-native" tabindex="-1"
                        style="position:absolute;left:0;top:100%;width:1px;height:1px;opacity:0;pointer-events:none;">
                </div>
                <div id="tm-ts-warn" style="margin-bottom:6px;"></div>
                <div id="tm-ts-info" style="margin-bottom:6px;color:#555;overflow:hidden;white-space:nowrap;"></div>
                <div id="tm-ts-out"></div>
            </div>`;
        document.body.appendChild(box);

        // --- przeciąganie okienka za nagłówek (pozycja zapamiętywana w przeglądarce) ---
        const head = box.querySelector('#tm-ts-head');
        const KEY = 'tm-ts-pos';
        const clamp = (left, top) => ({
            left: Math.max(0, Math.min(left, window.innerWidth - box.offsetWidth)),
            top: Math.max(0, Math.min(top, window.innerHeight - 30)),
        });
        const place = (left, top) => {
            const c = clamp(left, top);
            box.style.left = c.left + 'px';
            box.style.top = c.top + 'px';
            box.style.right = 'auto';
        };
        try {
            const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (saved && typeof saved.left === 'number') place(saved.left, saved.top);
        } catch (e) { /* brak zapisanej pozycji */ }
        window.addEventListener('resize', () => {
            if (box.style.right === 'auto') place(box.offsetLeft, box.offsetTop);
        });

        let drag = null;
        let moved = false;
        head.addEventListener('pointerdown', ev => {
            if (ev.button !== 0) return;
            const r = box.getBoundingClientRect();
            drag = { dx: ev.clientX - r.left, dy: ev.clientY - r.top, x: ev.clientX, y: ev.clientY };
            moved = false;
            head.setPointerCapture(ev.pointerId);
        });
        head.addEventListener('pointermove', ev => {
            if (!drag) return;
            if (!moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 4) return;
            moved = true;
            place(ev.clientX - drag.dx, ev.clientY - drag.dy);
        });
        head.addEventListener('pointerup', ev => {
            if (!drag) return;
            head.releasePointerCapture(ev.pointerId);
            drag = null;
            if (moved) {
                try { localStorage.setItem(KEY, JSON.stringify({ left: box.offsetLeft, top: box.offsetTop })); } catch (e) { /* ignoruj */ }
            }
        });

        head.addEventListener('click', () => {
            if (moved) { moved = false; return; } // to było przeciąganie, nie kliknięcie
            const b = box.querySelector('#tm-ts-body');
            const hidden = b.style.display === 'none';
            b.style.display = hidden ? '' : 'none';
            box.querySelector('#tm-ts-toggle').textContent = hidden ? '–' : '+';
        });
        const txt = box.querySelector('#tm-ts-date');
        const nat = box.querySelector('#tm-ts-native');
        const setDate = iso => {
            box.dataset.date = iso;
            txt.value = isoToPl(iso);
            nat.value = iso;
            txt.style.borderColor = '';
            render();
        };
        txt.addEventListener('change', () => {
            const iso = plToIso(txt.value);
            if (iso) setDate(iso);
            else { txt.value = isoToPl(box.dataset.date); txt.style.borderColor = 'red'; setTimeout(() => { txt.style.borderColor = ''; }, 1200); }
        });
        nat.addEventListener('change', () => { if (nat.value) setDate(nat.value); });
        box.querySelector('#tm-ts-cal').addEventListener('click', () => {
            try { nat.showPicker(); } catch (e) { nat.click(); }
        });
        box.dataset.date = today();
        txt.value = isoToPl(box.dataset.date);
        nat.value = box.dataset.date;
        box.querySelector('#tm-ts-warn').addEventListener('click', ev => {
            if (!ev.target.closest('.tm-ts-load')) return;
            const n = scan().notice;
            if (n) clickAll(n);
        });
        const outEl = box.querySelector('#tm-ts-out');
        outEl.addEventListener('scroll', ev => {
            if (ev.target.classList && ev.target.classList.contains('tm-ts-list')) listScroll = ev.target.scrollTop;
        }, true);
        // kółko myszy przewija listę partnerów (niezależnie od tego, co robi strona)
        outEl.addEventListener('wheel', ev => {
            const list = ev.target.closest && ev.target.closest('.tm-ts-list');
            if (!list) return;
            const max = list.scrollHeight - list.clientHeight;
            if (max <= 0) return;
            const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
            if ((dy < 0 && list.scrollTop <= 0) || (dy > 0 && list.scrollTop >= max)) return;
            list.scrollTop += dy;
            ev.preventDefault();
            ev.stopPropagation();
        }, { passive: false });
        box.querySelector('#tm-ts-out').addEventListener('click', ev => {
            const el = ev.target.closest('.tm-ts-min');
            if (!el) return;
            const old = el.textContent;
            copyText(el.dataset.copy).then(() => {
                el.textContent = '✓ skopiowano';
                setTimeout(() => { el.textContent = old; }, 900);
            }).catch(err => console.warn(LOG, 'Nie udało się skopiować', err));
        });
    }

    let lastHtml = null;
    let lastWarn = null;
    let lastInfo = null;
    let listScroll = 0; // zapamiętana pozycja przewinięcia listy partnerów

    function render() {
        const box = document.getElementById(PANEL_ID);
        if (!box) return;
        const date = box.dataset.date;
        const scanned = scan();
        const rows = scanned.entries.filter(e => e.date === date);
        const out = box.querySelector('#tm-ts-out');
        const info = box.querySelector('#tm-ts-info');
        const warn = box.querySelector('#tm-ts-warn');

        // ukryte komentarze: ostrzeż (dane mogą być niepełne) i daj przycisk do ręcznego rozwinięcia
        const hidden = scanned.notice;
        const warnHtml = hidden
            ? `<div style="color:#a60;font-size:11px;white-space:normal;">⚠ Widoczne ${hidden.shown} z ${hidden.total} komentarzy – ` +
              `podsumowanie może być niepełne. ` +
              `<button class="tm-ts-load" style="cursor:pointer;margin-left:4px;">Wczytaj wszystkie</button></div>`
            : '';
        if (warnHtml !== lastWarn) { warn.innerHTML = warnHtml; lastWarn = warnHtml; }

        if (!rows.length) {
            info.textContent = '';
            lastInfo = null;
            out.innerHTML = '<i>Brak timerów z komentarzem dla tego dnia.</i>';
            lastHtml = null;
            return;
        }

        // dopisek: z którego dnia i czyje timery (osoby wykrywane z wpisów, bez wyboru)
        const persons = [...new Set(rows.map(e => e.person))].join(', ');
        const infoHtml = `Podsumowanie timerów z dnia <b>${isoToPl(date)}</b> przez: <b>${persons.replace(/</g, '&lt;')}</b>`;
        if (infoHtml !== lastInfo) {
            info.title = `Podsumowanie timerów z dnia ${isoToPl(date)} przez: ${persons}`;
            info.innerHTML = infoHtml;
            fitText(info);
            lastInfo = infoHtml;
        }

        // suma per komentarz
        const byLabel = new Map();
        rows.forEach(e => {
            const cur = byLabel.get(e.label) || { sec: 0, n: 0, manual: 0 };
            cur.sec += e.seconds;
            cur.n += 1;
            if (e.manual) cur.manual += 1;
            byLabel.set(e.label, cur);
        });

        // suma całkowita: ten sam timer z 2 komentarzami liczony raz; wpisy ręczne zawsze osobno
        const uniq = new Map();
        rows.forEach((e, i) => uniq.set(e.manual ? 'manual|' + i : [e.start, e.end].join('|'), e.seconds));
        const total = [...uniq.values()].reduce((a, b) => a + b, 0);
        const sumLabels = rows.reduce((a, e) => a + e.seconds, 0);
        const manualCount = rows.filter(e => e.manual).length;

        // siatka o stałych kolumnach; przewija się tylko lista partnerów, RAZEM jest osobno pod nią
        const GRID = 'display:grid;grid-template-columns:minmax(0,1fr) 40px 52px 72px;column-gap:4px;align-items:baseline;line-height:18px;';
        const mono = 'text-align:right;font-family:monospace;';
        let html = `<div class="tm-ts-list" style="max-height:220px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:${BRAND} #eee;">`;
        [...byLabel.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pl', { sensitivity: 'base' })).forEach(([label, v]) => {
            const safe = label.replace(/</g, '&lt;');
            const man = v.manual ? ` <span title="w tym wpisów ręcznych: ${v.manual}">✎${v.manual}</span>` : '';
            html += `<div style="${GRID}border-bottom:1px solid #eee;">
                <span title="${safe}" style="overflow:hidden;text-overflow:ellipsis;">${safe}</span>
                <span style="color:#888;text-align:right;">×${v.n}${man}</span>
                <span style="${mono}">${fmt(v.sec)}</span>
                <span style="${mono}">${minCell(v.sec)}</span></div>`;
        });
        const totMan = manualCount ? ` <span title="w tym wpisów ręcznych: ${manualCount}">✎${manualCount}</span>` : '';
        html += `</div><div class="tm-ts-total" style="${GRID}border-top:1px solid ${BRAND};margin-top:2px;padding-top:2px;font-weight:bold;">
            <span style="color:${BRAND};">RAZEM</span>
            <span style="color:#888;font-weight:normal;text-align:right;" title="liczba wpisów">×${uniq.size}${totMan}</span>
            <span style="${mono}color:${BRAND};">${fmt(total)}</span>
            <span style="${mono}color:${BRAND};">${minCell(total)}</span></div>`;
        if (sumLabels !== total) {
            html += `<div style="margin-top:6px;color:#a60;font-size:11px;cursor:help;overflow:hidden;text-overflow:ellipsis;" title="Ten sam timer ma kilka komentarzy (np. dwie etykiety). Pod każdą etykietą liczy się jego pełny czas, ale w RAZEM tylko raz.">⚠ Suma po komentarzach: ${fmtFull(sumLabels)}</div>`;
        }
        // nie przebudowujemy listy, jeśli nic się nie zmieniło
        if (html === lastHtml) return;
        out.innerHTML = html;
        lastHtml = html;
        const list = out.querySelector('.tm-ts-list');
        const total_ = out.querySelector('.tm-ts-total');
        if (list) {
            list.scrollTop = listScroll; // przywróć pozycję przewinięcia
            // RAZEM wyrównane do listy także wtedy, gdy lista ma pasek przewijania
            total_.style.paddingRight = (list.offsetWidth - list.clientWidth) + 'px';
        }
    }

    // ---------- start + obserwacja zmian (React doładowuje dane) ----------
    let timer = null;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(() => { build(); render(); }, 900);
    }

    // czy zmiana dotyczy komentarzy (a nie np. menu, zegara czy naszego okienka)?
    const HINT = /spent\s+time|You\s+see\s+\d+\s+of\s+\d+\s+comments/;
    function relevant(muts) {
        const panel = document.getElementById(PANEL_ID);
        for (const m of muts) {
            const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
            if (!t || (panel && panel.contains(t))) continue;
            if (m.type === 'characterData') {
                if (HINT.test(m.target.data)) return true;
                continue;
            }
            for (const n of m.addedNodes) {
                if (n.nodeType === 1 ? HINT.test(n.textContent) : HINT.test(n.nodeValue || '')) return true;
            }
            for (const n of m.removedNodes) {
                if (n.nodeType === 1 && HINT.test(n.textContent)) return true;
            }
        }
        return false;
    }

    build();
    render();
    new MutationObserver(muts => { if (relevant(muts)) schedule(); })
        .observe(document.body, { childList: true, subtree: true, characterData: true });

    console.log(LOG, 'Podsumowanie timerów załadowane');
})();
