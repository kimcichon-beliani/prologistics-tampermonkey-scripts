// ==UserScript==
// @name         Prologistics – Podsumowanie timerów (issue logs)
// @namespace    kimrioter
// @version      1.7.0
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
    function fitText(el, max = 12, min = 8) {
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

    // ---------- ukryte komentarze ("You see 20 of 26 comments, click to see All comments") ----------
    let loadAttempts = 0;
    let lastClick = 0;

    function findNotice() {
        const panel = document.getElementById(PANEL_ID);
        const re = /You see (\d+) of (\d+) comments/;
        let found = null;
        // querySelectorAll idzie w kolejności dokumentu, więc ostatnie dopasowanie jest najgłębsze
        document.querySelectorAll('td, div, span, p').forEach(el => {
            if (panel && panel.contains(el)) return;
            const t = norm(el);
            if (t.length > 200) return;
            const m = t.match(re);
            if (m) found = { el, shown: +m[1], total: +m[2] };
        });
        return found;
    }

    function clickAll(notice) {
        const link = [...notice.el.querySelectorAll('a, button, [role="button"], span')]
            .find(e => e.children.length === 0 && /all comments/i.test(e.textContent));
        (link || notice.el).click();
        console.log(LOG, 'Klik w "All comments"');
    }

    // klika "All comments" (max 3 próby), zwraca informację o ukrytych komentarzach lub null
    function ensureAll() {
        const n = findNotice();
        if (!n) { loadAttempts = 0; return null; }
        if (loadAttempts < 3 && Date.now() - lastClick > 2000) {
            loadAttempts++;
            lastClick = Date.now();
            clickAll(n);
            setTimeout(schedule, 2200);
        }
        return n;
    }

    // ---------- zczytywanie ----------
    function readEntries() {
        const panel = document.getElementById(PANEL_ID);
        const found = [];
        document.querySelectorAll('span, td').forEach(el => {
            if (panel && panel.contains(el)) return;
            const text = norm(el);
            if (!text.includes('spent time')) return;
            const e = parse(text);
            if (!e) return;
            // bierzemy tylko najgłębszy element, żeby nie liczyć td + span podwójnie
            if ([...el.querySelectorAll('span, td')].some(c => parse(norm(c)))) return;
            found.push(e);
        });
        // duplikaty usuwamy tylko dla timerów (ręczne wpisy nie mają godziny końca,
        // więc dwa takie same wpisy to dwa osobne wpisy)
        const seen = new Set();
        return found.filter(e => {
            if (e.manual) return true;
            const k = [e.date, e.start, e.end, e.label].join('|');
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }

    // ---------- UI ----------
    function build() {
        if (document.getElementById(PANEL_ID)) return;
        const box = document.createElement('div');
        box.id = PANEL_ID;
        box.style.cssText = `position:fixed;top:51px;right:96px;z-index:99999;width:400px;max-width:90vw;max-height:70vh;box-sizing:border-box;white-space:nowrap;
            overflow:auto;background:#fff;border:2px solid ${BRAND};border-radius:10px;
            box-shadow:0 4px 16px rgba(0,0,0,.25);font:13px/1.4 Arial,sans-serif;color:#222;`;
        box.innerHTML = `
            <div id="tm-ts-head" style="background:${BRAND};color:#fff;padding:8px 12px;cursor:pointer;
                display:flex;justify-content:space-between;align-items:center;font-weight:bold;">
                <span>⏱ Summary of Timers</span><span id="tm-ts-toggle">–</span>
            </div>
            <div id="tm-ts-body" style="padding:10px 12px;">
                <div style="margin-bottom:8px;display:flex;align-items:center;gap:4px;position:relative;">
                    <input type="text" id="tm-ts-date" maxlength="10" placeholder="DD.MM.RRRR" title="Dzień.miesiąc.rok"
                        style="width:88px;padding:2px 4px;font-size:12px;text-align:center;box-sizing:border-box;">
                    <button type="button" id="tm-ts-cal" title="Wybierz z kalendarza"
                        style="cursor:pointer;padding:1px 5px;font-size:12px;">📅</button>
                    <input type="date" id="tm-ts-native" tabindex="-1"
                        style="position:absolute;left:0;top:100%;width:1px;height:1px;opacity:0;pointer-events:none;">
                </div>
                <div id="tm-ts-warn" style="margin-bottom:8px;"></div>
                <div id="tm-ts-info" style="margin-bottom:8px;color:#555;overflow:hidden;white-space:nowrap;"></div>
                <div id="tm-ts-out"></div>
            </div>`;
        document.body.appendChild(box);

        box.querySelector('#tm-ts-head').addEventListener('click', () => {
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
            const n = findNotice();
            if (n) { lastClick = Date.now(); clickAll(n); setTimeout(schedule, 2200); }
        });
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

    function render() {
        const box = document.getElementById(PANEL_ID);
        if (!box) return;
        const date = box.dataset.date;
        const rows = readEntries().filter(e => e.date === date);
        const out = box.querySelector('#tm-ts-out');
        const info = box.querySelector('#tm-ts-info');
        const warn = box.querySelector('#tm-ts-warn');

        // ukryte komentarze: spróbuj wczytać wszystkie, a jeśli się nie da – ostrzeż
        const hidden = ensureAll();
        warn.innerHTML = hidden
            ? `<div style="color:#a60;font-size:12px;white-space:normal;">⚠ Widoczne ${hidden.shown} z ${hidden.total} komentarzy – ` +
              `${loadAttempts >= 3 ? 'nie udało się wczytać automatycznie' : 'wczytuję pozostałe…'} ` +
              `<button class="tm-ts-load" style="cursor:pointer;margin-left:4px;">Wczytaj wszystkie</button></div>`
            : '';

        if (!rows.length) {
            info.textContent = '';
            out.innerHTML = '<i>Brak timerów z komentarzem dla tego dnia.</i>';
            return;
        }

        // dopisek: z którego dnia i czyje timery (osoby wykrywane z wpisów, bez wyboru)
        const persons = [...new Set(rows.map(e => e.person))].join(', ');
        info.title = `Podsumowanie timerów z dnia ${isoToPl(date)} przez: ${persons}`;
        info.innerHTML = `Podsumowanie timerów z dnia <b>${isoToPl(date)}</b> przez: <b>${persons.replace(/</g, '&lt;')}</b>`;
        fitText(info);

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

        const td = 'padding:2px 0;';
        let html = `<table style="table-layout:fixed;width:100%;border-collapse:collapse;font-size:12px;">
            <colgroup><col><col style="width:54px;"><col style="width:62px;"><col style="width:88px;"></colgroup>`;
        [...byLabel.entries()].sort((a, b) => b[1].sec - a[1].sec).forEach(([label, v]) => {
            const safe = label.replace(/</g, '&lt;');
            const man = v.manual ? ` <span title="w tym wpisów ręcznych: ${v.manual}">✎${v.manual}</span>` : '';
            html += `<tr style="border-bottom:1px solid #eee;">
                <td title="${safe}" style="${td}overflow:hidden;text-overflow:ellipsis;">${safe}</td>
                <td style="${td}color:#888;text-align:right;padding-right:8px;">×${v.n}${man}</td>
                <td style="${td}text-align:right;font-family:monospace;">${fmt(v.sec)}</td>
                <td style="${td}text-align:right;font-family:monospace;">${minCell(v.sec)}</td></tr>`;
        });
        const tt = 'padding:4px 0 0;font-weight:bold;';
        const totMan = manualCount ? ` <span title="w tym wpisów ręcznych: ${manualCount}">✎${manualCount}</span>` : '';
        html += `<tr>
            <td style="${tt}color:${BRAND};">RAZEM</td>
            <td style="${tt}color:#888;font-weight:normal;text-align:right;padding-right:8px;" title="liczba wpisów">×${uniq.size}${totMan}</td>
            <td style="${tt}text-align:right;font-family:monospace;color:${BRAND};">${fmt(total)}</td>
            <td style="${tt}text-align:right;font-family:monospace;color:${BRAND};">${minCell(total)}</td></tr></table>`;
        if (sumLabels !== total) {
            html += `<div style="margin-top:6px;color:#a60;font-size:12px;cursor:help;overflow:hidden;text-overflow:ellipsis;" title="Ten sam timer ma kilka komentarzy (np. dwie etykiety). Pod każdą etykietą liczy się jego pełny czas, ale w RAZEM tylko raz.">⚠ Suma po komentarzach: ${fmtFull(sumLabels)}</div>`;
        }
        out.innerHTML = html;
    }

    // ---------- start + obserwacja zmian (React doładowuje dane) ----------
    let timer = null;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(() => { build(); render(); }, 400);
    }

    build();
    render();
    new MutationObserver(muts => {
        const panel = document.getElementById(PANEL_ID);
        if (panel && muts.every(m => panel.contains(m.target))) return;
        schedule();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });

    console.log(LOG, 'Podsumowanie timerów załadowane');
})();
