// ==UserScript==
// @name         Prologistics – Podsumowanie timerów (issue logs)
// @namespace    kimrioter
// @version      1.0.0
// @description  Zczytuje timery z komentarzem z logów zadania i podsumowuje czas z wybranego dnia (per komentarz / osoba)
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

    // Tylko wpisy "commented on ... spent time from ... to ... (hh:mm:ss) "komentarz""
    // (wpisy "spent time on the task" bez komentarza i "added manually" są pomijane)
    const RE = /^(.+?) commented on .+? spent time from (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) to (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \((\d+):(\d{2}):(\d{2})\) "([\s\S]*)"\s*$/;

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
            const text = el.textContent.replace(/\s+/g, ' ').trim();
            if (!text.includes('commented on')) return;
            const m = text.match(RE);
            if (!m) return;
            // bierzemy tylko najgłębszy element, żeby nie liczyć td + span podwójnie
            const childMatches = [...el.querySelectorAll('span, td')].some(c =>
                RE.test(c.textContent.replace(/\s+/g, ' ').trim()));
            if (childMatches) return;
            found.push({
                person: m[1].trim(),
                startDate: m[2],
                start: m[3],
                end: m[5],
                seconds: (+m[6]) * 3600 + (+m[7]) * 60 + (+m[8]),
                label: m[9].trim() || '(pusty komentarz)',
            });
        });
        // usuń dokładne duplikaty (ta sama osoba, początek, koniec, komentarz)
        const seen = new Set();
        return found.filter(e => {
            const k = [e.person, e.startDate, e.start, e.end, e.label].join('|');
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
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <input type="date" id="tm-ts-date" style="flex:1;padding:3px;">
                    <select id="tm-ts-person" style="flex:1;padding:3px;"></select>
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
        box.querySelector('#tm-ts-person').addEventListener('change', render);
    }

    function render() {
        const box = document.getElementById(PANEL_ID);
        if (!box) return;
        const date = box.querySelector('#tm-ts-date').value;
        const personSel = box.querySelector('#tm-ts-person');
        const all = readEntries().filter(e => e.startDate === date);

        // lista osób (zachowaj wybór)
        const people = [...new Set(all.map(e => e.person))].sort();
        const prev = personSel.value || '__all__';
        personSel.innerHTML = '<option value="__all__">Wszyscy</option>' +
            people.map(p => `<option value="${p}">${p}</option>`).join('');
        personSel.value = people.includes(prev) || prev === '__all__' ? prev : '__all__';

        const rows = personSel.value === '__all__' ? all : all.filter(e => e.person === personSel.value);
        const out = box.querySelector('#tm-ts-out');

        if (!rows.length) {
            out.innerHTML = '<i>Brak timerów z komentarzem dla tego dnia.</i>';
            return;
        }

        // suma per komentarz
        const byLabel = new Map();
        rows.forEach(e => {
            const cur = byLabel.get(e.label) || { sec: 0, n: 0 };
            cur.sec += e.seconds;
            cur.n += 1;
            byLabel.set(e.label, cur);
        });

        // suma całkowita liczona po unikalnych timerach (ten sam timer z 2 komentarzami = raz)
        const uniq = new Map();
        rows.forEach(e => uniq.set([e.person, e.start, e.end].join('|'), e.seconds));
        const total = [...uniq.values()].reduce((a, b) => a + b, 0);
        const sumLabels = rows.reduce((a, e) => a + e.seconds, 0);

        let html = `<table style="width:100%;border-collapse:collapse;">`;
        [...byLabel.entries()].sort((a, b) => b[1].sec - a[1].sec).forEach(([label, v]) => {
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:3px 0;">${label.replace(/</g, '&lt;')} <span style="color:#888;">×${v.n}</span></td>
                <td style="padding:3px 0;text-align:right;font-family:monospace;">${fmt(v.sec)}</td></tr>`;
        });
        html += `<tr><td style="padding-top:6px;font-weight:bold;">RAZEM (unikalne timery: ${uniq.size})</td>
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
