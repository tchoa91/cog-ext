// --- renderer.js ---
// Responsabilité : Gérer tout l'affichage et le DOM

// Constantes graphiques
const SVGS = {
  chevron: `<svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`,
  defaultIcon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`,
};

const TOPBAR_HEIGHT = 90; // Doit être synchro avec le CSS

/**
 * Dessine les blocs de monitoring dans la TopBar
 * @param {HTMLElement} container - L'élément #topbar
 * @param {Array} metrics - Les données à afficher
 * @param {Function} onClickCallback - La fonction à appeler au clic
 */
export function renderTopBar(container, metrics, onClickCallback) {
  container.innerHTML = ""; // Reset

  metrics.forEach((m) => {
    const el = document.createElement("div");
    el.className = "monitor-block";

    // Logique couleur simple (Peut être complexifiée ici)
    let barColor = "var(--accent)";
    if (m.isStatus) barColor = m.val > 0 ? "var(--accent)" : "#ef5350";

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
    el.addEventListener("click", (e) => onClickCallback(m.label, e));
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
  container.innerHTML = "";

  cards.forEach((card) => {
    const cardEl = document.createElement("div");
    cardEl.className = "card";

    // Optionnel : Afficher le chevron ou non (par défaut oui ici)
    const showChevron = true;

    cardEl.innerHTML = `
            <h3>${card.title}</h3>
            <div class="card-icon">${SVGS.defaultIcon}</div>
            ${
              showChevron
                ? `<div class="card-watermark">${SVGS.chevron}</div>`
                : ""
            }
        `;

    cardEl.addEventListener("click", (e) => onClickCallback(card.title, e));
    container.appendChild(cardEl);
  });
}

/**
 * Gère l'ouverture et l'animation de l'Overlay
 */
export function openOverlayUI(elements, title, event) {
  const { overlay, overlayTitle } = elements;

  // On cible le contenu pour l'animer
  // Note: Assurez-vous que votre HTML a bien un élément avec la classe .overlay-content
  const content = overlay.querySelector(".overlay-content");

  // Calcul de l'origine (pour que le "pop" vienne du bon endroit si c'est une ouverture)
  const rect = event.currentTarget.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  let centerY = rect.top + rect.height / 2;
  if (centerY < TOPBAR_HEIGHT) centerY = 0;
  else centerY = centerY - TOPBAR_HEIGHT;

  // Est-ce que l'overlay est DÉJÀ là ?
  if (overlay.classList.contains("active")) {
    // --- MODE TRANSITION ---
    // 1. On met à jour l'origine pour une sensation physique cohérente (optionnel mais mieux)
    overlay.style.transition =
      "transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.1)"; // On garde la fluidité
    overlay.style.transformOrigin = `${centerX}px ${centerY}px`;

    // 2. Fade Out du contenu
    if (content) {
      content.style.transition = "opacity 0.15s ease";
      content.style.opacity = "0";

      // 3. Changement de texte et Fade In après court délai
      setTimeout(() => {
        overlayTitle.textContent = title;
        content.style.opacity = "1";
      }, 150);
    } else {
      // Fallback si pas de .overlay-content trouvé
      overlayTitle.textContent = title;
    }
  } else {
    // --- MODE OUVERTURE NORMALE ---
    overlayTitle.textContent = title;
    overlay.style.transformOrigin = `${centerX}px ${centerY}px`;

    // Reset opacité si nécessaire
    if (content) content.style.opacity = "1";

    overlay.classList.remove("hidden");
    void overlay.offsetWidth; // Force Reflow
    overlay.classList.add("active");
  }
}

/**
 * Ferme l'Overlay
 */
export function closeOverlayUI(overlayElement) {
  overlayElement.classList.remove("active");
  // Le CSS gère le fade-out et le pointer-events
}
