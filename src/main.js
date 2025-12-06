// --- main.js ---
// Responsabilité : Logique métier, Données, Événements

import { renderTopBar, renderGrid, openOverlayUI, closeOverlayUI } from './renderer.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements (Cache) ---
    const uiElements = {
        grid: document.getElementById('dashboard-grid'),
        overlay: document.getElementById('overlay'),
        overlayTitle: document.getElementById('overlay-title'),
        closeBtn: document.getElementById('close-overlay'),
        topBar: document.getElementById('topbar')
    };

    // --- Données Mockup (État) ---
    const rawCardsData = [
        { id: 'shortcuts', title: 'Raccourcis' },
        { id: 'history', title: 'Historique' },
        { id: 'storage-mgr', title: 'Stockage Local', requiresStorage: true },
        { id: 'tabs', title: 'Onglets' },
        { id: 'notes', title: 'Notes Rapides', requiresStorage: true },
        { id: 'convert', title: 'Convertisseur' },
        { id: 'color', title: 'Pipette' },
        { id: 'json', title: 'JSON Tools' },
        { id: 'network', title: 'Mon IP' },
        { id: 'settings', title: 'Paramètres' }
    ];

    // --- Logique Métier ---
    
    // Simulation check API
    const checkStorageSupport = () => true; 

    // Bascule de thème
    function initTheme() {
        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.body.setAttribute('data-theme', 'light');
        }
    }

    // Gestionnaire de Clic (Callback centralisé)
    const handleItemClick = (title, event) => {
        openOverlayUI(uiElements, title, event);
    };

    // --- Initialisation ---

    function init() {
        initTheme();

        // 1. Préparation TopBar
        const metrics = [
            { label: 'CPU', val: 12, displayVal: '12%' },
            { label: 'MEM', val: 68, displayVal: '68%' },
            { label: 'NET', val: 100, displayVal: 'ON', isStatus: true },
            { label: 'BATT', val: 85, displayVal: '85%' }
        ];
        renderTopBar(uiElements.topBar, metrics, handleItemClick);

        // 2. Préparation Grille
        // Le filtrage se fait ICI, le renderer ne fait qu'afficher ce qu'on lui donne
        const activeCards = rawCardsData.filter(c => !c.requiresStorage || checkStorageSupport());
        renderGrid(uiElements.grid, activeCards, handleItemClick);

        // 3. Events Globaux
        setupGlobalEvents();
    }

    function setupGlobalEvents() {
        // Fermeture Overlay (Croix)
        uiElements.closeBtn.addEventListener('click', () => closeOverlayUI(uiElements.overlay));

        // Fermeture Overlay (Clic n'importe où : Fond OU Contenu)
        // CORRECTION : On a supprimé la restriction "if (e.target === uiElements.overlay)"
        // L'overlay se ferme maintenant au clic sur toute sa surface.
        uiElements.overlay.addEventListener('click', () => {
             closeOverlayUI(uiElements.overlay);
        });

        // Toggle Thème (Double clic)
        uiElements.grid.addEventListener('dblclick', (e) => {
            if (e.target === uiElements.grid) {
                const currentTheme = document.body.getAttribute('data-theme');
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.body.setAttribute('data-theme', newTheme);
            }
        });
    }

    // Lancement
    init();
});
