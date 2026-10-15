// ==UserScript==
// @name         Prologistics – Podsumowanie timerów (issue logs)
// @namespace    kimrioter
// @version      1.1.0
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
    const RE_TIMER = /^.+? commented on .+? spent time from (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) to (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \((\d+):(\d{2}):(\d{2})\) "([\s\S]*)"\s*$/;
    const RE_MANUAL = /^.+? added manually spent time on (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \((\d+):(\d{2}):(\d{2})\) "([\s\S]*)"\s*$/;

    const norm = el => el.textContent.replace(/\s+/g, ' ').trim();

    function parse(text) {
        let m = text.match(RE_TIMER);
        if (m) {
            return {
                manual: false, date: m[1], start: m[2], end: m[4],
                seconds: (+m[5]) * 3600 + (+m[6]) * 60 + (+m[7]),
                label: m[8].trim() || '(pusty komentarz)',
            };
        }
        m = text.match(RE_MANUAL);
        if (m) {
            return {
                manual: true, date: m[1], start: m[2], end: null,
                seconds: (+m[3]) * 3600 + (+m[4]) * 60 + (+m[5]),
                label: m[6].trim() || '(pusty komentarz)',
            };
        }
        return null;
    }

    const today = () => {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };

    const fmt = sec => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        const p = n => String(n).padStart(2, '0');
        return `${p(h)}:${p(m)}:${p(s)}`;
    };

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
        box.style.cssText = `position:fixed;right:16px;bottom:16px;z-index:99999;width:340px;max-height:70vh;
            overflow:auto;background:#fff;border:2px solid ${BRAND};border-radius:10px;
            box-shadow:0 4px 16px rgba(0,0,0,.25);font:13px/1.4 Arial,sans-serif;color:#222;`;
        box.innerHTML = `
            <div id="tm-ts-head" style="background:${BRAND};color:#fff;padding:8px 12px;cursor:pointer;
                display:flex;justify-content:space-between;align-items:center;font-weight:bold;">
                <span>⏱ Podsumowanie timerów</span><span id="tm-ts-toggle">–</span>
            </div>
            <div id="tm-ts-body" style="padding:10px 12px;">
                <div style="margin-bottom:8px;">
                    <input type="date" id="tm-ts-date" style="width:100%;padding:3px;box-sizing:border-box;">
                </div>
                <div id="tm-ts-out"></div>
            </div>`;
        document.body.appendChild(box);

        box.querySelector('#tm-ts-date').value = today();
        box.querySelector('#tm-ts-head').addEventListener('click', () => {
            const b = box.querySelector('#tm-ts-body');
            const hidden = b.style.display === 'none';
            b.style.display = hidden ? '' : 'none';
            box.querySelector('#tm-ts-toggle').textContent = hidden ? '–' : '+';
        });
        box.querySelector('#tm-ts-date').addEventListener('change', render);
    }

    function render() {
        const box = document.getElementById(PANEL_ID);
        if (!box) return;
        const date = box.querySelector('#tm-ts-date').value;
        const rows = readEntries().filter(e => e.date === date);
        const out = box.querySelector('#tm-ts-out');

        if (!rows.length) {
            out.innerHTML = '<i>Brak timerów z komentarzem dla tego dnia.</i>';
            return;
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

        let html = `<table style="width:100%;border-collapse:collapse;">`;
        [...byLabel.entries()].sort((a, b) => b[1].sec - a[1].sec).forEach(([label, v]) => {
            const man = v.manual ? ` <span style="color:#888;">(ręcznie: ${v.manual})</span>` : '';
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:3px 0;">${label.replace(/</g, '&lt;')} <span style="color:#888;">×${v.n}</span>${man}</td>
                <td style="padding:3px 0;text-align:right;font-family:monospace;">${fmt(v.sec)}</td></tr>`;
        });
        html += `<tr><td style="padding-top:6px;font-weight:bold;">RAZEM (wpisów: ${uniq.size}${manualCount ? ', w tym ręcznych: ' + manualCount : ''})</td>
            <td style="padding-top:6px;text-align:right;font-weight:bold;font-family:monospace;color:${BRAND};">${fmt(total)}</td></tr></table>`;
        if (sumLabels !== total) {
            html += `<div style="margin-top:6px;color:#a60;font-size:12px;">⚠ Ten sam timer ma kilka komentarzy – w sumie liczony raz (suma po komentarzach: ${fmt(sumLabels)}).</div>`;
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
