/* ====================================================================
   MEDNOTES — sw.js
   Service Worker: cache do app shell para uso offline (Passo 17).
   Estratégia: cache-first para o shell, sempre-network para a API do
   Google Drive (nunca serve dados de sincronização do cache).
==================================================================== */

'use strict';

const CACHE_NAME = 'mednotes-shell-v2';
const SHELL_FILES = [
    'notes.html',
    'notes.css',
    'notes-views.css',
    'notes.js',
    'notes-views.js',
    'notes-drive.js',
    'notes-worker.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(SHELL_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Nunca cachear chamadas ao Google (OAuth/Drive API/fonts) — sempre network.
    if (url.origin !== self.location.origin) return;

    // Só GET é cacheável; outros métodos (raros no app shell) passam direto.
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((res) => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return res;
            });
        }).catch(() => caches.match('notes.html'))
    );
});
