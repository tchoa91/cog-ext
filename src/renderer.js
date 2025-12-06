// --- renderer.js ---
// Responsabilité : Gérer tout l'affichage et le DOM

// Constantes graphiques
const SVGS = {
    chevron: `<svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`,
    defaultIcon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`
};

const TOPBAR_HEIGHT = 90; // Doit être synchro avec le CSS

/**
 * Dessine les blocs de monitoring dans la TopBar
 * @param {HTMLElement} container - L'élément #topbar
 * @param {Array} metrics - Les données à afficher
 * @param {Function} onClickCallback - La fonction à appeler au clic
 */
export function renderTopBar(container, metrics, onClickCallback) {
    container.innerHTML = ''; // Reset
    
    metrics.forEach(m => {
        const el = document.createElement('div');
        el.className = 'monitor-block';
        
        // Logique couleur simple (Peut être complexifiée ici)
        let barColor = 'var(--accent)'; 
        if (m.isStatus) barColor = m.val > 0 ? 'var(--accent)' : '#ef5350';
        
        el.innerHTML = `
            <div class="monitor-header">
                <span>${m.label}</span>
                <span class="monitor-val-text">${m.displayVal}</span>
            </div>
            <div class="monitor-bar-track">
                <div class="monitor-bar-fill" style="width: ${m.val}%; background-color: ${barColor}"></div>
            </div>
        `;
        
        // On attache l'événement
        el.addEventListener('click', (e) => onClickCallback(m.label, e));
        container.appendChild(el);
    });
}

/**
 * Dessine la grille de cartes
 * @param {HTMLElement} container - L'élément #dashboard-grid
 * @param {Array} cards - La liste des cartes FILTRÉES à afficher
 * @param {Function} onClickCallback - La fonction à appeler au clic
 */
export function renderGrid(container, cards, onClickCallback) {
    container.innerHTML = '';
    
    cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        
        // Optionnel : Afficher le chevron ou non (par défaut oui ici)
        const showChevron = true; 

        cardEl.innerHTML = `
            <h3>${card.title}</h3>
            <div class="card-icon">${SVGS.defaultIcon}</div>
            ${showChevron ? `<div class="card-watermark">${SVGS.chevron}</div>` : ''}
        `;
        
        cardEl.addEventListener('click', (e) => onClickCallback(card.title, e));
        container.appendChild(cardEl);
    });
}

/**
 * Gère l'ouverture et l'animation de l'Overlay
 */
export function openOverlayUI(elements, title, event) {
    const { overlay, overlayTitle } = elements;
    
    overlayTitle.textContent = title;

    // Calcul géométrique du Zoom
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    let centerY = (rect.top + rect.height / 2);
    
    // Correction par rapport à la TopBar
    if (centerY < TOPBAR_HEIGHT) centerY = 0; 
    else centerY = centerY - TOPBAR_HEIGHT;

    overlay.style.transformOrigin = `${centerX}px ${centerY}px`;

    overlay.classList.remove('hidden');
    void overlay.offsetWidth; // Force Reflow pour l'animation CSS
    overlay.classList.add('active');
}

/**
 * Ferme l'Overlay
 */
export function closeOverlayUI(overlayElement) {
    overlayElement.classList.remove('active');
    // Le CSS gère le fade-out et le pointer-events
}
