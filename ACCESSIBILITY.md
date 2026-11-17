&nbsp;

# Accessibility Architecture & Engineering Guide

**COGext** is built on a simple engineering observation: **passing an automated accessibility check does not make an interface usable.**

### Why V2 Required a Ground-Up Rewrite

* **COGext v1 (Compliant by Standard, Unusable in Practice):** Originally built as a lightweight technical demo, v1 rendered system telemetry as a single, flat dynamic list. While it satisfied basic normative rules on paper, real-world testing exposed a major usability failure: continuously mutating raw metrics flooded screen readers with repetitive chatter and forced sequential navigation through noisy data. It was *technically compliant*, yet *practically inaccessible*.  
* **COGext v2 (Ergonomic Design & Machine-to-Human Re-Synchronization):** Version 2 was re-architected from scratch around actual human usage:  
  * **Progressive Spatial Ergonomics (Grid \+ Overlay):** Replacing the flat list with a two-tier layout—a scannable summary **Grid** (anchored by a persistent TopBar) and focused detail **Overlays**—reduces cognitive load and lets users drill down only when needed.  
  * **MVC Decoupling for Machine/Human Re-Synchronization:** Hardware APIs poll at machine speed, whereas human perception and speech synthesizers operate on a slower, semantic rhythm. Using a strict vanilla JavaScript MVC architecture (`data-store.js` \-\> `main.js` \-\> `renderer.js`), COGext decouples raw data collection from semantic state synthesis and DOM mutations—re-synchronizing high-frequency machine telemetry with human listening and reading cadence.  
  * **Simple, Structural WCAG 2.2 Rules:** Rather than relying on heavy ARIA patches or external overlays, v2 applies straightforward WCAG 2.2 fundamentals: semantic grouping, `inert`\-based modal isolation, deterministic focus restoration, relative `rem` scaling, and high-contrast theming.  
  * **Real-World Assistive Testing:** Every interaction pattern is validated through keyboard-only navigation and live **ChromeVox** screen reader sessions on ChromeOS, ensuring genuine auditory clarity alongside WCAG 2.2 Level AAA alignment.

## 1\. MVC Architecture & Machine-to-Human Re-Synchronization

System monitors face an inherent timing conflict: hardware metrics fluctuate several times per second, whereas human reading and speech synthesis require stable, discrete snapshots. Naive dashboards bind raw telemetry directly to DOM nodes or live regions, flooding screen readers with stale, overlapping speech queues.

COGext resolves this across its three MVC layers:

### Scope-Aware Data Layer (`data-store.js`)

* **Targeted Polling (`getSystemState(scope)`):** Only the four core TopBar monitors (CPU, memory, battery, network) are polled continuously. Secondary modules (storage partitions, multi-display topology, installed extensions) are queried exclusively when their matching view is active (`scope === "cards"` for the full grid, `scope === activeOverlayId` for an open detail overlay, or `scope === null` in Mini Mode).  
* **Adaptive TTL Caching:** Network latency, storage, and display queries are cached for 5 seconds (`TTL.FAST = 5000`), public IP checks back off from 30 seconds (`TTL.SLOW_INIT`) to 5 minutes (`TTL.SLOW_STABLE`) once stable, and static hardware/browser metadata is cached for the session.

### Dual-Cadence Controller (`main.js`)

* **Visual Layer — 5 Hz (`UPDATE_INTERVAL = 200` ms):** GPU-accelerated progress bars (`scaleX`/`scaleY`) and the HTML5 `<canvas>` CPU sparkline update every 200 ms for smooth visual feedback.  
* **Semantic & Text Layer — 1 Hz (`TEXT_UPDATE_RATIO = 5`):** Formatted strings and `aria-label` attributes update only once every 5 ticks (`tickCount % 5 === 0`). Screen readers receive steady, intelligible state snapshots without sub-second numerical jitter.  
* **Zero-Latency Overlay Opening:** When a user opens a detail overlay, `onOpen` primes `tickCount = TEXT_UPDATE_RATIO - 1` so the very next 200 ms tick forces an immediate text and ARIA pass.

### Differential DOM Cache (`renderer.js`)

* **Mutation Guardrails:** The renderer tracks previous values across `cache.monitors`, `cache.cards`, and `cache.overlay`. DOM text nodes and `aria-label` attributes are mutated **only when a formatted value or threshold state (`normal`, `warning`, `alert`) actually changes**, preventing redundant accessibility tree invalidations.

## 2\. Universal Semantic Synthesis (`generateGraphSemantics`)

A foundational principle of accessible design is **universal parity: one interface, one message, one action—never a separate "screen-reader-only" mode.**

Visual users glancing at an 8- to 16-core bar chart still have to mentally compute whether the system is idle, evenly loaded, or bottlenecked on a single thread. Conversely, screen reader users cannot parse a dozen fluctuating bars sequentially.

In `main.js`, `generateGraphSemantics(cores)` translates raw per-core percentage arrays into a concise, human-readable diagnostic sentence rendered **visibly for all users** at the top of the CPU Details overlay (`#cpuSemanticDesc` / `.overlay-desc`):

* **Variance & Asymmetry Detection:** Flags uneven, single-thread spikes whenever any core deviates by more than 30 percentage points from the average (`Math.abs(val - avg) > 30`).  
* **Global Workload Classification:** Synthesizes overall CPU behavior into four localized states:  
  * *System idle* (`avg < 20` and `max < 40`)  
  * *Critical global overload* (`avg > THRESHOLDS.cpu.alert` — 90%)  
  * *Asymmetric activity* (uneven multi-core load)  
  * *Homogeneous load* (balanced multi-core distribution)  
* **Anomaly Pinpointing:** Isolates cores crossing `THRESHOLDS.cpuCores.alert` (85%) and aggregates them into one natural sentence (all cores overloaded, single core ID \+ percentage, identical-load group, or min–max range).

---

## 3\. ARIA Tree Pruning & Speech Pacing

To eliminate screen reader chatter while preserving full telemetry density, `popup.html` and `renderer.js` enforce four structural rules:

### Semantic Grouping (`aria-labelledby` \+ `aria-hidden`)

* **Unified Interactive Controls:** Each TopBar `.monitor-block` and dashboard `.card` exposes a single accessible node (`role="button"`, `tabindex="0"`, `aria-labelledby="card-title-<id> card-body-<id>"`). Purely decorative children (`.card-watermark`, `.monitor-bar-track`, `.monitor-dot`) are hidden from the accessibility tree with `aria-hidden="true"`.  
* **Composite Charts as Single Images (`role="img"`):** Multi-element visualizations—the per-core load grid (`.overlay-cores-grid`) and thermal sensor grid (`.overlay-temp-grid`)—declare `role="img"` on the container, mark individual bars and cells `aria-hidden="true"`, and expose one consolidated `aria-label`.

### Label Expansion & Vocal Punctuation

* **Abbreviation Expansion:** In `#topbar`, compact visual labels (`CPU`, `MEM`, `BAT`, `NET`) resolve to their full localized card titles (`linkedCard.title`) via `aria-label`.  
* **Cadence & Threshold Formatting (`setAriaLabelForValue`):** Terse visual placeholders (`"N/A"`, `"--"`, `"-"`) are translated into full localized strings (`t("val_na")`). Threshold states (`Warning`, `Alert`) are prepended explicitly, and a trailing period (`". "`) is appended so speech synthesizers pause cleanly between label, value, and state.

### Throttled Global Status Alerts (`#aria-alerts`)

* `popup.html` defines a single polite status region (`role="status"`, `aria-live="polite"`).  
* `transformDataToRenderFormat()` aggregates abnormal states across all monitors and cards into one structured sentence (e.g., *"Alert : CPU. Warning : Battery."*).  
* `updateInterface()` applies a **15-second throttle (`ALERT_THROTTLE = 15000`)**: new state changes announce immediately, persistent conditions repeat at most once every 15 seconds, and the region is cleared silently once all metrics return to normal.

---

## 4\. Keyboard Parity, Focus Restoration & `inert` Isolation

* **Full Keyboard Parity:** Interactive monitors, dashboard cards, and theme color swatches (`role="button"`) respond identically to `Enter` and `Space` (calling `e.preventDefault()` on `Space` to prevent page scrolling). Custom toggle switches (`<input type="checkbox">`) bind `Enter` to `.click()` alongside native `Space` support.  
* **True Modal Isolation via `inert` (`setOverlayState`):** Opening a detail overlay (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="overlay-title"`) sets `gridEl.inert = true`, removing background cards from both the keyboard tab order and the screen reader virtual cursor.  
* **Mini-Mode Isolation (`setMiniMode`):** Collapsing the dashboard into the compact TopBar sets `main.inert = true`, `main.setAttribute("aria-hidden", "true")`, and strips `tabindex` and `role="button"` from TopBar monitors so focus stays cleanly anchored on `#mini-toggle`.  
* **Deterministic Focus Restoration:** Before opening an overlay, the triggering element is saved in `lastFocusedElement`. On close, focus returns to that exact control via a double `requestAnimationFrame` callback once the browser has lifted `inert` and updated the accessibility tree.

---

## 5\. Visual, Cognitive & Linguistic Ergonomics

* **Relative Scaling & One-Click Zoom:** All dimensions in `style.css` use `rem` units driven by root font scaling (`applyZoom` in `main.js`: `80%` compact default vs. `100%` zoomed mode) without layout clipping.  
* **Theme & Contrast Separation:** Supports Dark Mode (default) and Light Mode (`[data-theme="light"]`), plus 5 curated HSL ambiance hues (`MOOD_COLORS` in `config.js`), while keeping semantic warning (`hsl(35, 90%, 50%)`) and alert (`hsl(0, 80%, 60%)`) indicators visually distinct.  
* **Explicit Focus Rings:** Interactive controls define high-contrast `:focus-visible` outlines (`0.125rem solid var(--text-main)`).  
* **Full Localization (23 Locales):** All UI labels, ARIA descriptions, threshold prefixes, and pluralized CPU diagnostic sentences are localized across 23 languages in `_locales/`.

---

## 6\. Verification Protocol

Every release of COGext is validated through a three-step manual protocol—the exact workflow applied when developing and testing `popup.html`, `renderer.js`, `main.js`, and `style.css`:

1. **Keyboard-Only Walkthrough:** Navigate `#topbar`, `#dashboard-grid`, overlays, toggle switches, and color swatches using only `Tab`, `Shift+Tab`, `Enter`, and `Space`, confirming zero focus traps and deterministic focus restoration when closing an overlay.  
2. **Live Screen Reader Audit (ChromeVox):**  
    * **Navigation Mode:** Verify alignment between visual layout, logical DOM structure, and focus order; validate the information quality and phrasing announced for each region; and check transitions between zones (opening overlays, isolating the background via `inert` or Mini Mode, and restoring focus on close).
    * **Read Mode:** Validate sequential reading order, test structural jumping to skim sections (`H` for headings, `B` for buttons/cards) before resuming continuous reading, and confirm that speech interruptions from live updates (`#aria-alerts`, 1 Hz cadence) are relevant and never cut off ongoing announcements prematurely.
3. **Zoom, Contrast & Color-Vision Simulation (Chrome DevTools):** Toggle Zoom (`100%`), Light/Dark themes, and ambiance colors (`MOOD_COLORS`), and use **Chrome DevTools** (*Rendering \-\> Emulate vision deficiencies* and the built-in contrast ratio inspector) to verify legibility across protanopia, deuteranopia, tritanopia, achromatopsia, and blurred vision.

---

## 7\. Built for the User, Not the Coder

An interface is no longer a raw dump of internal APIs or developer data structures—**it is built for the human using it.**

Designing around human perception and real-world ergonomics pays off directly across the entire codebase:

* **Cleaner Architecture:** Decoupling data (`data-store.js`), semantic synthesis (`main.js`), and rendering (`renderer.js`) keeps the code small, modular, and free of ad-hoc ARIA patches.  
* **Zero Bloat:** Full WCAG 2.2 AAA support was achieved in pure vanilla JavaScript with zero dependencies, zero frameworks, and no overlay scripts—keeping the codebase compact, readable, and fast to load.  
* **Lower Runtime Overhead:** Throttling text mutations to human reading speed and skipping unchanged DOM writes cuts unnecessary CPU and battery usage.  
* **Faster Power-User Ergonomics:** Full keyboard parity and progressive disclosure (Grid \+ Overlay) make the dashboard faster to navigate even without a screen reader.  
* **Automation & Agent Readiness:** A clean, noise-free semantic tree is natively interpretable by both assistive technologies and local AI agents.  
* **Professional & Universal Credibility:** A cohesive, thoughtfully paced interface signals genuine engineering craft—earning immediate user trust and broader ecosystem recognition across every profile.

&nbsp;
