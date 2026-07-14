/* ====================================================================
   MEDNOTES — notes-worker.js
   Simplificação de path (Ramer-Douglas-Peucker) — Passo 18, Fase 4.

   Arquivo dual-use: roda como Web Worker (self.onmessage) OU como
   <script> normal no documento (define MedNotes.Geometry.rdp), para
   que notes.js tenha um caminho síncrono de fallback com a MESMA
   implementação, sem duplicar a lógica.
==================================================================== */

(function (global) {
    'use strict';

    function perpDist(p, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
    }

    // RDP iterativo (pilha, sem recursão), preservando picos de pressão.
    // Mesma lógica de MedNotes.Canvas._rdp em notes.js.
    function rdp(points, eps) {
        const n = points.length;
        if (n < 3) return points.slice();

        const keep = new Array(n).fill(false);
        keep[0] = true; keep[n - 1] = true;
        const stack = [[0, n - 1]];

        while (stack.length) {
            const [start, end] = stack.pop();
            if (end <= start + 1) continue;
            const a = points[start], b = points[end];
            const span = end - start;

            let maxDist = -1, maxIdx = -1;
            let maxPDelta = -1, maxPIdx = -1;
            for (let i = start + 1; i < end; i++) {
                const dist = perpDist(points[i], a, b);
                if (dist > maxDist) { maxDist = dist; maxIdx = i; }

                const t = (i - start) / span;
                const interpP = a.p + (b.p - a.p) * t;
                const pDelta = Math.abs((points[i].p ?? 0.5) - interpP);
                if (pDelta > maxPDelta) { maxPDelta = pDelta; maxPIdx = i; }
            }

            if (maxDist > eps && maxIdx !== -1) {
                keep[maxIdx] = true;
                stack.push([start, maxIdx]);
                stack.push([maxIdx, end]);
            } else if (maxPDelta > 0.08 && maxPIdx !== -1) {
                keep[maxPIdx] = true;
                stack.push([start, maxPIdx]);
                stack.push([maxPIdx, end]);
            }
        }

        const out = [];
        for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
        return out;
    }

    if (typeof importScripts === 'function' && typeof document === 'undefined') {
        // Contexto de Worker
        self.onmessage = function (e) {
            const { id, cmd, points, eps } = e.data || {};
            if (cmd !== 'rdp') return;
            self.postMessage({ id, points: rdp(points, eps) });
        };
    } else {
        // Contexto de documento (fallback síncrono)
        global.MedNotes = global.MedNotes || {};
        global.MedNotes.Geometry = { rdp };
    }
})(typeof self !== 'undefined' ? self : this);
