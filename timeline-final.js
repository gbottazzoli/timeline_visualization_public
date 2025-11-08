// Timeline ULTRA-SIMPLE - Version fonctionnelle
let timelineData = null;

// Gestion des tabs du footer - DOIT être défini avant le chargement du DOM
window.switchTab = function(tabName, clickedTab) {
    // Cacher toutes les sections
    document.querySelectorAll('.footer-section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.footer-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Afficher la section demandée
    const section = document.getElementById(tabName + '-section');
    if (section) {
        section.classList.add('active');
    }
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
};

async function loadData() {
    try {
        const response = await fetch('data/timeline_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        timelineData = await response.json();

        if (!timelineData || typeof timelineData !== 'object') {
            throw new Error('Invalid timeline data format');
        }

        renderTimeline();
        setupEventListeners();
        renderStats();
        initializeTooltip();

        // Rendre la timeline responsive au redimensionnement
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                try {
                    renderTimeline();
                } catch (err) {
                    console.error('[RENDER ERROR]', err);
                }
            }, 300); // Debounce de 300ms
        });
    } catch (error) {
        console.error('[LOAD ERROR] Failed to load timeline data:', error);
        document.getElementById('timeline-viz').innerHTML =
            `<div style="padding: 20px; color: #e74c3c; text-align: center;">
                <h3>❌ Erreur de chargement</h3>
                <p>Impossible de charger les données de la timeline.</p>
                <p><small>${error.message}</small></p>
            </div>`;
    }
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    return new Date(String(dateStr)).getTime();
}

// Calculer segments PAR JOUR - uniquement les jours avec événements
function calculateSegments(allDates, minDate, maxDate) {
    // PHASE 1: Grouper les événements par jour
    const dayMap = new Map();

    allDates.forEach(timestamp => {
        if (!timestamp) return;

        // Normaliser à minuit pour obtenir le jour
        const date = new Date(timestamp);
        const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

        if (!dayMap.has(dayKey)) {
            dayMap.set(dayKey, {
                date: dayKey,
                year: date.getFullYear(),
                month: date.getMonth(),
                day: date.getDate(),
                eventCount: 0
            });
        }
        dayMap.get(dayKey).eventCount++;
    });

    // Convertir en tableau et trier chronologiquement
    const days = Array.from(dayMap.values()).sort((a, b) => a.date - b.date);

    // PHASE 2: Calculer largeurs proportionnelles à la densité
    // Adapter la largeur selon l'appareil pour une expérience optimale
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;

    let TARGET_TOTAL_WIDTH;
    if (isMobile) {
        // Mobile: 2.5x largeur écran (bon compromis exploration/lisibilité)
        TARGET_TOTAL_WIDTH = Math.max(screenWidth * 2.5, 800);
    } else if (isTablet) {
        // Tablette: utiliser largeur écran avec minimum
        TARGET_TOTAL_WIDTH = Math.max(screenWidth - 40, 1000);
    } else {
        // Desktop: comportement actuel
        TARGET_TOTAL_WIDTH = Math.max(screenWidth - 40, 1200);
    }

    const MIN_WIDTH = 21; // Largeur minimale par jour
    const BASE_WIDTH = 28; // Largeur de base par jour

    const segments = [];
    let xPosition = 0;

    // Calculer densité max pour normalisation
    const maxDensity = Math.max(...days.map(d => d.eventCount), 1);

    days.forEach((d, index) => {
        // Largeur proportionnelle à la densité du jour
        const densityRatio = d.eventCount / maxDensity;
        const widthMultiplier = 1 + (densityRatio * 3); // 1x à 4x la base
        let width = BASE_WIDTH * widthMultiplier;

        // Appliquer largeur minimale
        if (d.eventCount <= 2) {
            width = MIN_WIDTH;
        }

        // RÉDUCTION SPÉCIALE: 1940 à juillet 1941 = réduire de 40%
        if ((d.year === 1940) || (d.year === 1941 && d.month <= 6)) {
            width = width * 0.6;
        }

        // Définir le segment du jour (de minuit à minuit+1j)
        const dayStart = d.date;
        const dayEnd = d.date + (24 * 60 * 60 * 1000);

        segments.push({
            startDate: dayStart,
            endDate: dayEnd,
            width: Math.round(width),
            xStart: xPosition,
            eventCount: d.eventCount,
            year: d.year,
            month: d.month,
            day: d.day
        });

        xPosition += Math.round(width);
    });

    // PHASE 3: Normaliser pour tenir dans la largeur cible
    const actualTotalWidth = xPosition;
    const scaleFactor = TARGET_TOTAL_WIDTH / actualTotalWidth;

    // Appliquer le facteur d'échelle
    let scaledX = 0;
    segments.forEach(seg => {
        seg.width = Math.round(seg.width * scaleFactor);
        seg.xStart = scaledX;
        scaledX += seg.width;
    });

    return segments;
}

// Convertir timestamp vers position X en utilisant les segments
function dateToX(timestamp, segments) {
    if (!timestamp) return 0;

    // Trouver le segment contenant cette date
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (timestamp >= seg.startDate && timestamp < seg.endDate) {
            // Position relative dans le segment
            const ratio = (timestamp - seg.startDate) / (seg.endDate - seg.startDate);
            return seg.xStart + (ratio * seg.width);
        }
    }

    // Si hors des segments, utiliser le dernier segment
    const lastSeg = segments[segments.length - 1];
    return lastSeg.xStart + lastSeg.width;
}

function renderTimeline() {
    const container = document.getElementById('timeline');
    const showT1 = document.getElementById('show-t1').checked;
    const showT2 = document.getElementById('show-t2').checked;
    const showT3 = document.getElementById('show-t3').checked;
    const expandSources = document.getElementById('expand-sources').checked;

    console.log(`[RENDER] showT1=${showT1}, showT2=${showT2}, showT3=${showT3}`);

    // Collecter dates de TOUTES les timelines pour calculer segments corrects (T4 supprimé)
    const allDates = [
        ...timelineData.timeline_1_events.map(e => parseDate(e.date_start)),
        ...timelineData.timeline_2_swiss_view.map(e => parseDate(e.date_start)),
        ...timelineData.timeline_3_microactions.map(e => parseDate(e.date_start))
    ].filter(d => d);

    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);

    // Calculer segments de largeur variable selon densité
    const segments = calculateSegments(allDates, minDate, maxDate);
    const totalWidth = segments.reduce((sum, seg) => sum + seg.width, 0);

    // Définir la largeur minimum pour forcer le scroll horizontal
    const minWidth = Math.max(totalWidth, 2000);

    let html = `<div style="width: ${minWidth}px; position: relative; padding-top: 50px; min-width: ${minWidth}px;">`;

    // Grille temporelle avec segments
    html += renderGrid(minDate, maxDate, segments);

    // Les 3 timelines (T4 supprimé)
    if (showT1) html += renderTrack('T1: Sources directes', timelineData.timeline_1_events, '#e74c3c', 't1', minDate, maxDate, segments, 0, expandSources);
    if (showT2) html += renderTrack('T2: Vue suisse', timelineData.timeline_2_swiss_view, '#3498db', 't2', minDate, maxDate, segments, 1, expandSources);
    if (showT3) html += renderTrack('T3: Micro-actions', timelineData.timeline_3_microactions, '#2ecc71', 't3', minDate, maxDate, segments, 2, expandSources);

    html += '</div>';

    // FORCER la largeur du #timeline (le container) AVANT d'insérer le HTML
    container.style.width = minWidth + 'px';
    container.style.minWidth = minWidth + 'px';

    container.innerHTML = html;

    attachTooltipEvents();

    // Dessiner les chaînes de communication si T3 est affiché ET si toggle chaînes activé
    const showChains = document.getElementById('show-chains')?.checked ?? true;
    console.log(`[RENDER] About to check showT3: ${showT3}, showChains: ${showChains}`);
    if (showT3 && showChains) {
        console.log('[RENDER] showT3 and showChains are true, scheduling drawCommunicationChains');
        requestAnimationFrame(() => {
            console.log('[RENDER] requestAnimationFrame callback executing');
            drawCommunicationChains(minDate, maxDate, segments);
        });
    } else {
        console.log('[RENDER] showT3 or showChains is false, skipping chains');
        // Supprimer le SVG des chaînes s'il existe
        const existingSvg = document.getElementById('chain-links-svg');
        if (existingSvg) {
            existingSvg.remove();
        }
    }

    // Dessiner les trous informationnels (toujours, indépendamment des toggles)
    requestAnimationFrame(() => {
        drawInformationGaps(minDate, maxDate, segments);
        drawFloatingLabelsT1(minDate, maxDate, segments);
        // ✅ Dessiner les labels T2 (événements exclusifs à T2)
        drawFloatingLabelsT2(minDate, maxDate, segments);
    });
}

// Mettre en évidence une chaîne de communication complète
function highlightChain(fromId, toId) {
    console.log(`[CHAINS] Highlighting chain involving ${fromId} → ${toId}`);

    const chainLinks = timelineData.timeline_3_chain_links || [];

    // Construire l'ensemble des micro-actions dans la chaîne
    const chainMicroActions = new Set();
    const chainLinkPairs = new Set();

    // Fonction récursive pour trouver toutes les micro-actions connectées
    function addToChain(microId, visited = new Set()) {
        if (visited.has(microId)) return;
        visited.add(microId);
        chainMicroActions.add(microId);

        // Trouver tous les liens sortants et entrants
        chainLinks.forEach(link => {
            if (link.from_id === microId) {
                chainLinkPairs.add(`${link.from_id}→${link.to_id}`);
                addToChain(link.to_id, visited);
            }
            if (link.to_id === microId) {
                chainLinkPairs.add(`${link.from_id}→${link.to_id}`);
                addToChain(link.from_id, visited);
            }
        });
    }

    // Démarrer la recherche depuis les deux extrémités du lien survolé
    addToChain(fromId);
    addToChain(toId);

    console.log(`[CHAINS] Chain contains ${chainMicroActions.size} micro-actions and ${chainLinkPairs.size} links`);

    // Mettre en évidence les liens de la chaîne, atténuer les autres
    const allVisiblePaths = document.querySelectorAll('.chain-link-visible');
    allVisiblePaths.forEach(path => {
        const pathFrom = path.getAttribute('data-from-id');
        const pathTo = path.getAttribute('data-to-id');
        const pairKey = `${pathFrom}→${pathTo}`;

        if (chainLinkPairs.has(pairKey)) {
            // Mettre en évidence ce lien
            path.setAttribute('opacity', '1');
            path.setAttribute('stroke-width', '2.5');
            const currentStroke = path.getAttribute('stroke');
            path.setAttribute('stroke', currentStroke === '#9b59b6' ? '#8e44ad' : '#2c3e50');
        } else {
            // Atténuer les autres liens
            path.setAttribute('opacity', '0.1');
        }
    });

    // Mettre en évidence les micro-actions de la chaîne
    const allMicroActions = document.querySelectorAll('[data-micro-id]');
    allMicroActions.forEach(el => {
        const microId = el.getAttribute('data-micro-id');
        if (chainMicroActions.has(microId)) {
            // Mettre en évidence
            el.style.transform = 'scale(1.2)';
            el.style.zIndex = '200';
            el.style.filter = 'brightness(1.2) saturate(1.3)';
            el.style.transition = 'all 0.2s ease';
        } else {
            // Atténuer
            el.style.opacity = '0.3';
            el.style.transition = 'opacity 0.2s ease';
        }
    });
}

// Réinitialiser la mise en évidence des chaînes
function resetChainHighlight() {
    console.log('[CHAINS] Resetting chain highlight');

    // Réinitialiser tous les liens visibles
    const allVisiblePaths = document.querySelectorAll('.chain-link-visible');
    allVisiblePaths.forEach(path => {
        path.setAttribute('opacity', '0.4');
        path.setAttribute('stroke-width', '1');
        const linkType = path.getAttribute('stroke') === '#8e44ad' || path.getAttribute('stroke') === '#9b59b6' ? '#9b59b6' : '#95a5a6';
        path.setAttribute('stroke', linkType);
    });

    // Réinitialiser toutes les micro-actions
    const allMicroActions = document.querySelectorAll('[data-micro-id]');
    allMicroActions.forEach(el => {
        el.style.transform = '';
        el.style.zIndex = '';
        el.style.filter = '';
        el.style.opacity = '';
    });
}

// Dessiner les chaînes de communication (liens visuels entre micro-actions)
function drawCommunicationChains(minDate, maxDate, segments) {
    console.log('[CHAINS] Function called');
    const chainLinks = timelineData.timeline_3_chain_links || [];

    if (chainLinks.length === 0) {
        console.log('[CHAINS] No chain links to draw');
        return;
    }

    console.log(`[CHAINS] Drawing ${chainLinks.length} communication chain links`);

    // Vérifier si des éléments T3 avec data-micro-id existent
    const microActionElements = document.querySelectorAll('[data-micro-id]');
    console.log(`[CHAINS] Found ${microActionElements.length} elements with data-micro-id`);

    // Créer ou récupérer le SVG overlay
    const container = document.getElementById('timeline');
    let svg = document.getElementById('chain-links-svg');

    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'chain-links-svg';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '60'; // Entre la grille et les barres d'incertitude

        container.appendChild(svg);
    } else {
        // Vider le SVG existant
        svg.innerHTML = '';
    }

    // Définir le marker arrow pour les flèches (minuscules, taille réduite de moitié)
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead-chain');
    marker.setAttribute('markerWidth', '1');
    marker.setAttribute('markerHeight', '1');
    marker.setAttribute('refX', '1');
    marker.setAttribute('refY', '0.5');
    marker.setAttribute('orient', 'auto');

    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M 0 0 L 1 0.5 L 0 1 Z');
    arrowPath.setAttribute('fill', '#95a5a6');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Dessiner chaque lien
    let drawnCount = 0;
    chainLinks.forEach((link, index) => {
        // Trouver les éléments DOM des micro-actions
        // Utiliser querySelectorAll et filter pour gérer les caractères spéciaux
        let fromElement = null;
        let toElement = null;

        const allMicroActions = document.querySelectorAll('[data-micro-id]');
        allMicroActions.forEach(el => {
            const microId = el.getAttribute('data-micro-id');
            if (microId === link.from_id) fromElement = el;
            if (microId === link.to_id) toElement = el;
        });

        if (!fromElement || !toElement) {
            console.log(`[CHAINS] Missing elements for link ${index}: from=${!!fromElement}, to=${!!toElement}, from_id="${link.from_id}", to_id="${link.to_id}"`);
            return;
        }

        // Calculer les positions relatives au container
        const containerRect = container.getBoundingClientRect();
        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();

        const fromX = fromRect.left - containerRect.left + (fromRect.width / 2);
        const fromY = fromRect.top - containerRect.top + (fromRect.height / 2);
        const toX = toRect.left - containerRect.left + (toRect.width / 2);
        const toY = toRect.top - containerRect.top + (toRect.height / 2);

        // Créer une courbe de Bézier cubique
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        // Points de contrôle pour une courbe en arc
        const ctrlY = Math.min(fromY, toY) - 20; // Arc vers le haut
        const ctrlX1 = fromX + (toX - fromX) * 0.3;
        const ctrlX2 = fromX + (toX - fromX) * 0.7;

        const pathD = `M ${fromX} ${fromY}
                       C ${ctrlX1} ${ctrlY}, ${ctrlX2} ${ctrlY}, ${toX} ${toY}`;

        path.setAttribute('d', pathD);
        path.setAttribute('stroke', link.link_type === 'REPLIES_TO' ? '#9b59b6' : '#95a5a6');
        path.setAttribute('stroke-width', '1');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', link.link_type === 'REPLIES_TO' ? '3,3' : '4,2');
        path.setAttribute('opacity', '0.4');
        path.setAttribute('marker-end', 'url(#arrowhead-chain)');
        path.setAttribute('class', 'chain-link');
        path.setAttribute('data-from-id', link.from_id);
        path.setAttribute('data-to-id', link.to_id);

        // Rendre les liens interactifs pour le hover
        path.style.pointerEvents = 'stroke';
        path.style.cursor = 'pointer';
        path.style.strokeWidth = '8'; // Zone de survol plus large
        path.style.stroke = 'transparent'; // Invisible mais interactive

        // Ajouter un path visible au-dessus
        const visiblePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        visiblePath.setAttribute('d', pathD);
        visiblePath.setAttribute('stroke', link.link_type === 'REPLIES_TO' ? '#9b59b6' : '#95a5a6');
        visiblePath.setAttribute('stroke-width', '1');
        visiblePath.setAttribute('fill', 'none');
        visiblePath.setAttribute('stroke-dasharray', link.link_type === 'REPLIES_TO' ? '3,3' : '4,2');
        visiblePath.setAttribute('opacity', '0.4');
        visiblePath.setAttribute('marker-end', 'url(#arrowhead-chain)');
        visiblePath.setAttribute('class', 'chain-link-visible');
        visiblePath.setAttribute('data-from-id', link.from_id);
        visiblePath.setAttribute('data-to-id', link.to_id);
        visiblePath.style.pointerEvents = 'none';

        // Événements de survol sur le path invisible
        path.addEventListener('mouseenter', () => {
            highlightChain(link.from_id, link.to_id);
        });

        path.addEventListener('mouseleave', () => {
            resetChainHighlight();
        });

        svg.appendChild(path);
        svg.appendChild(visiblePath);
        drawnCount++;
    });

    console.log(`[CHAINS] Successfully drew ${drawnCount} chain links`);
}

// Dessiner les trous informationnels (bandes verticales gris rosé)
function drawInformationGaps(minDate, maxDate, segments) {
    console.log('[GAPS] Drawing information gaps');

    // Vérifier si le toggle est activé
    const showGaps = document.getElementById('highlight-gaps')?.checked;
    if (!showGaps) {
        console.log('[GAPS] Gaps disabled, removing existing SVG');
        // Supprimer le SVG existant si présent
        const existingSvg = document.getElementById('information-gaps-svg');
        if (existingSvg) {
            existingSvg.remove();
        }
        return;
    }

    const informationGaps = timelineData.information_gaps || [];

    if (informationGaps.length === 0) {
        console.log('[GAPS] No information gaps to draw');
        return;
    }

    console.log(`[GAPS] Drawing ${informationGaps.length} information gaps`);

    // Créer ou récupérer le SVG overlay pour les gaps
    const container = document.getElementById('timeline');
    let svg = document.getElementById('information-gaps-svg');

    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'information-gaps-svg';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none'; // Transparent par défaut
        svg.style.zIndex = '10'; // Derrière la grille (z-index: 50) et les événements

        container.appendChild(svg);
    } else {
        // Vider le SVG existant
        svg.innerHTML = '';
    }

    // Dessiner chaque gap comme une bande verticale
    informationGaps.forEach((gap, index) => {
        const startTimestamp = parseDate(gap.start_date);
        const endTimestamp = parseDate(gap.end_date);

        if (!startTimestamp || !endTimestamp) {
            console.log(`[GAPS] Invalid timestamps for gap ${index}`);
            return;
        }

        // Calculer les positions X
        const startX = dateToX(startTimestamp, segments);
        const endX = dateToX(endTimestamp, segments);
        const width = endX - startX;

        console.log(`[GAPS] Gap ${index}: ${gap.start_date} → ${gap.end_date}, startX=${startX}, endX=${endX}, width=${width}`);

        // Créer le rectangle vertical (gris rosé avec transparence)
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', startX);
        rect.setAttribute('y', '0');
        rect.setAttribute('width', width);
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', '#d8bfd8'); // Gris rosé (thistle color)
        rect.setAttribute('opacity', '0.25'); // Transparence
        rect.setAttribute('class', 'information-gap');
        rect.style.pointerEvents = 'auto'; // Activer les événements de pointeur sur ce rect
        rect.style.cursor = 'help'; // Curseur d'aide pour indiquer qu'il y a une info

        // Événements de survol pour afficher un tooltip HTML personnalisé
        rect.addEventListener('mouseenter', (e) => {
            showGapTooltip(e, gap);
        });

        rect.addEventListener('mousemove', (e) => {
            // Faire suivre le tooltip au curseur
            const tooltip = document.getElementById('gap-tooltip');
            if (tooltip && tooltip.style.display === 'block') {
                // Même logique de positionnement intelligent que showGapTooltip
                const tooltipWidth = 350;
                const windowWidth = window.innerWidth;
                const spaceOnRight = windowWidth - e.clientX;

                if (spaceOnRight < tooltipWidth + 30) {
                    tooltip.style.left = (e.clientX - tooltipWidth - 15) + 'px';
                } else {
                    tooltip.style.left = (e.clientX + 15) + 'px';
                }

                tooltip.style.top = (e.clientY - 10) + 'px';
            }
        });

        rect.addEventListener('mouseleave', () => {
            hideGapTooltip();
        });

        svg.appendChild(rect);
    });

    console.log(`[GAPS] Successfully drew ${informationGaps.length} information gaps`);
}

// Afficher tooltip pour un trou informationnel
function showGapTooltip(event, gap) {
    // Créer ou récupérer le tooltip
    let tooltip = document.getElementById('gap-tooltip');

    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'gap-tooltip';
        tooltip.style.position = 'fixed';
        tooltip.style.backgroundColor = 'rgba(50, 50, 50, 0.95)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '12px 16px';
        tooltip.style.borderRadius = '8px';
        tooltip.style.fontSize = '13px';
        tooltip.style.lineHeight = '1.5';
        tooltip.style.zIndex = '10000';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.maxWidth = '350px';
        tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        document.body.appendChild(tooltip);
    }

    // Contenu du tooltip
    const severityColor = gap.severity === 'HIGH' ? '#e74c3c' : '#f39c12';
    const severityLabel = gap.severity === 'HIGH' ? 'CRITIQUE' : 'MODÉRÉ';

    tooltip.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px; color: ${severityColor};">
            Trou informationnel ${severityLabel}
        </div>
        <div style="margin-bottom: 6px;">
            <strong>Période:</strong> ${formatDate(gap.start_date)} → ${formatDate(gap.end_date)}
        </div>
        <div style="margin-bottom: 6px;">
            <strong>Durée:</strong> ${gap.duration_days} jours
        </div>
        <div style="font-size: 12px; color: #bbb; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
            Période avec très faible activité diplomatique (micro-actions T3)
        </div>
    `;

    // Positionner le tooltip près du curseur
    tooltip.style.display = 'block';

    // Calculer si le tooltip déborderait à droite
    const tooltipWidth = 350; // maxWidth défini dans le style
    const windowWidth = window.innerWidth;
    const spaceOnRight = windowWidth - event.clientX;

    // Si pas assez d'espace à droite, afficher à gauche du curseur
    if (spaceOnRight < tooltipWidth + 30) {
        tooltip.style.left = (event.clientX - tooltipWidth - 15) + 'px';
    } else {
        tooltip.style.left = (event.clientX + 15) + 'px';
    }

    tooltip.style.top = (event.clientY - 10) + 'px';
}

// Masquer tooltip des trous informationnels
function hideGapTooltip() {
    const tooltip = document.getElementById('gap-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

// Formater une date pour l'affichage
function formatDate(dateStr) {
    if (!dateStr) return 'n/c';
    const date = new Date(dateStr);
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Mapping hardcodé des titres pour les événements T1
function getHardcodedT1Label(eventDate, eventType) {
    const dateKey = eventDate ? eventDate.substring(0, 10) : '';
    const type = eventType.toLowerCase();

    // Mapping exact date + type → titre (types en anglais du JSON)
    const labelMap = {
        '1941-03-29_arrest': 'Arrestation, Paris',
        '1941-08-04_imprisonment': 'Emprisonnement à Cherche-Midi Paris',
        '1942-04-17_transfer': 'Transfert Cherche-Midi à la Santé, Paris',
        '1942-04-17_imprisonment': 'Emprisonnement à La Santé, Paris',
        '1942-04-21_transfer': 'Transfert à Karlsruhe',
        '1942-04-21_imprisonment': 'Emprisonnement à Karlsruhe',
        '1942-04-28_transfer': 'Transfert Karlsruhe à Anrath',
        '1942-06-17_zuchthaus': 'Emprisonnement à Anrath'
    };

    const key = `${dateKey}_${type}`;
    return labelMap[key] || null;
}

// Parser la description pour extraire: Type d'événement, Date, Lieu
function parseEventDescription(description, eventDate, eventType) {
    if (!description) return 'n/c';

    // D'abord essayer le mapping hardcodé
    const hardcodedLabel = getHardcodedT1Label(eventDate, eventType);
    if (hardcodedLabel) {
        return hardcodedLabel;
    }

    // Fallback: formater générique
    const formattedDate = formatDate(eventDate);
    const cleanEventType = eventType.charAt(0).toUpperCase() + eventType.slice(1).toLowerCase();
    return `${cleanEventType} ${formattedDate}`;
}

// Labels flottants pour événements T1 (sources directes)
function drawFloatingLabelsT1(minDate, maxDate, segments) {
    console.log('[LABELS-T1] Drawing floating labels for T1 events');

    // Vérifier si T1 est activé
    const showT1 = document.getElementById('show-t1')?.checked;
    if (!showT1) {
        console.log('[LABELS-T1] T1 is disabled, skipping labels');
        // Supprimer le conteneur existant si présent
        const existingContainer = document.getElementById('floating-labels-t1');
        if (existingContainer) {
            existingContainer.remove();
        }
        return;
    }

    // Vérifier si le mode "déplier sources" est activé
    const expandSources = document.getElementById('expand-sources')?.checked;
    if (expandSources) {
        console.log('[LABELS-T1] Expand sources mode enabled, skipping labels');
        // Supprimer le conteneur existant si présent
        const existingContainer = document.getElementById('floating-labels-t1');
        if (existingContainer) {
            existingContainer.remove();
        }
        return;
    }

    const t1Events = timelineData.timeline_1_events || [];
    if (t1Events.length === 0) {
        console.log('[LABELS-T1] No T1 events to label');
        return;
    }

    // Créer ou récupérer le conteneur pour les labels
    const timeline = document.getElementById('timeline');
    let labelContainer = document.getElementById('floating-labels-t1');

    if (!labelContainer) {
        labelContainer = document.createElement('div');
        labelContainer.id = 'floating-labels-t1';
        labelContainer.style.position = 'absolute';
        labelContainer.style.top = '0';
        labelContainer.style.left = '0';
        labelContainer.style.width = '100%';
        labelContainer.style.height = '100%';
        labelContainer.style.pointerEvents = 'none';
        labelContainer.style.zIndex = '100'; // Au-dessus des autres éléments
        timeline.appendChild(labelContainer);
    } else {
        labelContainer.innerHTML = '';
    }

    // Créer ou récupérer le SVG pour les lignes de connexion
    let svg = document.getElementById('label-connectors-t1');

    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'label-connectors-t1';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '95'; // Juste en dessous des labels
        timeline.appendChild(svg);
    } else {
        svg.innerHTML = '';
    }

    // Préparer les données pour placement
    const labelData = t1Events.map((event, index) => {
        const timestamp = parseDate(event.date_start);
        if (!timestamp) return null;

        const x = dateToX(timestamp, segments);
        const y = 100; // Ligne T1 est à y=100

        // Extraire les informations
        const title = event.description || 'N/A';
        const shortTitle = title.length > 35 ? title.substring(0, 35) + '...' : title;

        // ✅ Utiliser event_type_fr depuis les données (déjà traduit)
        const eventType = event.event_type_fr || 'Événement';

        // ✅ Utiliser place_name depuis les données (déjà extrait)
        const location = event.place_name && event.place_name !== 'n.c.' ? event.place_name : '';

        const date = formatDate(event.date_start);

        return {
            event,
            x,
            y,
            title: shortTitle,
            eventType,
            location,
            date,
            index
        };
    }).filter(d => d !== null);

    // Dédupliquer les événements par event_id
    const uniqueEvents = new Map();
    labelData.forEach(item => {
        const eventId = item.event.event_id;
        if (!uniqueEvents.has(eventId)) {
            uniqueEvents.set(eventId, item);
        }
    });
    const dedupedLabelData = Array.from(uniqueEvents.values());

    // Supprimer la première arrestation si plusieurs existent
    const arrestationIndices = dedupedLabelData
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => item.eventType === 'Arrestation');

    if (arrestationIndices.length > 1) {
        // Supprimer le premier
        const firstArrestIndex = arrestationIndices[0].idx;
        dedupedLabelData.splice(firstArrestIndex, 1);
        console.log(`[LABELS-T1] Suppressed first 'Arrestation' label (duplicate)`);
    }

    console.log(`[LABELS-T1] ${t1Events.length} events total, ${dedupedLabelData.length} unique events after dedup and filter`);

    // Algorithme de placement harmonieux BI-DIRECTIONNEL (au-dessus et en dessous)
    // ✅ Paramètres adaptatifs selon l'appareil
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;

    const viewportWidth = Math.max(screenWidth - 40, 800);
    const labelWidth = isMobile ? 200 : (isTablet ? 240 : 280);
    const labelHeight = 25;
    const minHorizontalGap = isMobile ? 15 : 25;
    const rowHeight = 30;
    const maxRowsBelow = 1;
    const maxRowsAbove = 2;

    // Trier par position X
    dedupedLabelData.sort((a, b) => a.x - b.x);

    // Placement: chaque label cherche la première ligne avec espace (en dessous d'abord, puis au-dessus)
    const placements = [];
    const rowsBelow = []; // [{minX, maxX}] pour chaque ligne en dessous
    const rowsAbove = []; // [{minX, maxX}] pour chaque ligne au-dessus

    dedupedLabelData.forEach((data, i) => {
        const eventX = data.x;
        const offsetRight = 5; // Petit décalage à droite de l'événement

        // Positionner le label juste À DROITE de l'événement
        let labelStartX = eventX + offsetRight;
        let labelEndX = labelStartX + labelWidth;

        // S'assurer que le label ne sort pas du viewport visible
        if (labelEndX > viewportWidth) {
            // Si le label sortirait à droite, le repositionner à GAUCHE de l'événement
            labelEndX = eventX - offsetRight;
            labelStartX = labelEndX - labelWidth;
            // Si ça sort à gauche, le forcer au bord droit du viewport
            if (labelStartX < 0) {
                labelStartX = 0;
                labelEndX = labelWidth;
            }
        }
        if (labelStartX < 0) {
            labelStartX = 0;
            labelEndX = labelWidth;
        }

        const finalStartX = labelStartX;
        const finalEndX = labelEndX;

        // Fonction helper pour vérifier collision sur une ligne
        const hasCollisionOnRow = (row) => {
            for (const existing of row) {
                if ((finalStartX < existing.maxX + minHorizontalGap) &&
                    (finalEndX > existing.minX - minHorizontalGap)) {
                    return true;
                }
            }
            return false;
        };

        // Stratégie de placement: ALTERNER strictement au-dessus/en dessous
        let rowIndex = 0;
        let foundRow = false;
        let isAbove = false;

        // Alterner: pair = au-dessus, impair = en dessous
        const preferAbove = (i % 2 === 0);

        if (preferAbove) {
            // Essayer AU-DESSUS en priorité
            while (!foundRow && rowIndex < maxRowsAbove) {
                if (!rowsAbove[rowIndex]) {
                    rowsAbove[rowIndex] = [];
                }

                if (!hasCollisionOnRow(rowsAbove[rowIndex])) {
                    rowsAbove[rowIndex].push({ minX: finalStartX, maxX: finalEndX });
                    foundRow = true;
                    isAbove = true;
                } else {
                    rowIndex++;
                }
            }

            // Fallback: essayer en dessous
            if (!foundRow) {
                rowIndex = 0;
                while (!foundRow && rowIndex < maxRowsBelow) {
                    if (!rowsBelow[rowIndex]) {
                        rowsBelow[rowIndex] = [];
                    }

                    if (!hasCollisionOnRow(rowsBelow[rowIndex])) {
                        rowsBelow[rowIndex].push({ minX: finalStartX, maxX: finalEndX });
                        foundRow = true;
                        isAbove = false;
                    } else {
                        rowIndex++;
                    }
                }
            }
        } else {
            // Essayer EN DESSOUS en priorité
            while (!foundRow && rowIndex < maxRowsBelow) {
                if (!rowsBelow[rowIndex]) {
                    rowsBelow[rowIndex] = [];
                }

                if (!hasCollisionOnRow(rowsBelow[rowIndex])) {
                    rowsBelow[rowIndex].push({ minX: finalStartX, maxX: finalEndX });
                    foundRow = true;
                    isAbove = false;
                } else {
                    rowIndex++;
                }
            }

            // Fallback: essayer au-dessus
            if (!foundRow) {
                rowIndex = 0;
                while (!foundRow && rowIndex < maxRowsAbove) {
                    if (!rowsAbove[rowIndex]) {
                        rowsAbove[rowIndex] = [];
                    }

                    if (!hasCollisionOnRow(rowsAbove[rowIndex])) {
                        rowsAbove[rowIndex].push({ minX: finalStartX, maxX: finalEndX });
                        foundRow = true;
                        isAbove = true;
                    } else {
                        rowIndex++;
                    }
                }
            }
        }

        // Si toujours pas de place, forcer alternativement
        if (!foundRow) {
            if (preferAbove) {
                rowIndex = 0;
                if (!rowsAbove[rowIndex]) {
                    rowsAbove[rowIndex] = [];
                }
                rowsAbove[rowIndex].push({ minX: finalStartX, maxX: finalEndX });
                isAbove = true;
            } else {
                rowIndex = 0;
                if (!rowsBelow[rowIndex]) {
                    rowsBelow[rowIndex] = [];
                }
                rowsBelow[rowIndex].push({ minX: finalStartX, maxX: finalEndX });
                isAbove = false;
            }
        }

        // Calculer yOffset (positif = en dessous, négatif = au-dessus)
        const yOffset = isAbove
            ? -(30 + (rowIndex * rowHeight))  // Au-dessus: décalage négatif
            : (30 + (rowIndex * rowHeight));   // En dessous: décalage positif

        placements.push({
            x: eventX,              // Position X de l'événement (pour la ligne)
            labelX: finalStartX,    // Position X du label (à droite de l'événement)
            yOffset,
            data,
            row: rowIndex,
            isAbove
        });
    });

    // Charger les positions sauvegardées (si elles existent)
    const savedPositions = JSON.parse(localStorage.getItem('t1LabelsPositions') || '{}');

    // Créer les labels et les lignes de connexion
    placements.forEach((placement, placementIndex) => {
        const { x, labelX, yOffset, data, isAbove } = placement;

        // Utiliser position sauvegardée SEULEMENT si valide (pas trop près de T1)
        const savedPos = savedPositions[data.index];
        // Position valide si: existe ET est suffisamment éloignée de T1 (au moins 20px)
        const isValidSavedPos = savedPos && Math.abs(savedPos.y - data.y) > 20;
        const finalLabelY = isValidSavedPos ? savedPos.y : (data.y + yOffset);
        const finalLabelX = isValidSavedPos ? savedPos.x : labelX;

        // Créer le label (carte moderne - DRAGGABLE)
        const label = document.createElement('div');
        label.style.position = 'absolute';
        label.style.left = finalLabelX + 'px';
        label.style.top = finalLabelY + 'px';
        // ✅ Largeur dynamique selon le contenu
        label.style.display = 'inline-block';
        label.style.maxWidth = '300px';
        label.style.padding = '3px 5px';
        // ✅ Design plus discret
        label.style.background = 'rgba(255, 255, 255, 0.75)';
        label.style.borderRadius = '2px';
        label.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
        label.style.border = '1px solid rgba(231, 76, 60, 0.15)';
        label.style.pointerEvents = 'auto';
        label.style.cursor = 'pointer';
        label.style.fontSize = '8px';
        label.style.lineHeight = '1.2';
        label.style.userSelect = 'none';
        label.style.zIndex = '1000';
        label.style.transition = 'all 0.2s ease';
        label.dataset.eventIndex = data.index;

        // ✅ Créer le label avec eventType et place_name
        const fullTitle = data.location
            ? `${data.eventType} - ${data.location}`
            : `${data.eventType} n.c`;

        label.innerHTML = `
            <div style="font-weight: 400; color: rgba(231, 76, 60, 0.85); font-size: 8px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${fullTitle}
            </div>
        `;

        // ✅ Effet hover pour rendre plus visible
        label.addEventListener('mouseenter', () => {
            if (!isDragging) {
                label.style.background = 'rgba(255, 255, 255, 0.95)';
                label.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
                label.style.borderColor = 'rgba(231, 76, 60, 0.3)';
                label.style.cursor = 'grab';
            }
        });

        label.addEventListener('mouseleave', () => {
            if (!isDragging) {
                label.style.background = 'rgba(255, 255, 255, 0.75)';
                label.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
                label.style.borderColor = 'rgba(231, 76, 60, 0.15)';
                label.style.cursor = 'pointer';
            }
        });

        // Créer la ligne de connexion (pas de cercle - utilise les points T1 existants)
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        // Fonction pour mettre à jour la ligne (BI-DIRECTIONNELLE)
        const updateConnector = () => {
            const labelRect = label.getBoundingClientRect();
            const containerRect = labelContainer.getBoundingClientRect();

            const currentLabelX = labelRect.left - containerRect.left + labelRect.width / 2;
            const currentLabelY = labelRect.top - containerRect.top;

            const startX = x;
            const startY = data.y;
            const endX = currentLabelX;

            // Déterminer si le label est au-dessus ou en dessous
            const labelIsBelow = currentLabelY > startY;
            const endY = labelIsBelow ? currentLabelY : (currentLabelY + labelRect.height);

            // Courbe Bézier - toujours afficher la ligne (au-dessus ou en dessous)
            const controlY = (startY + endY) / 2;
            const pathD = `M ${startX} ${startY} Q ${startX} ${controlY}, ${endX} ${endY}`;
            path.setAttribute('d', pathD);
            path.style.display = 'block';
        };

        // ✅ Ligne de connexion plus discrète
        path.setAttribute('stroke', '#e74c3c');
        path.setAttribute('stroke-width', '1');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.25');
        path.setAttribute('stroke-dasharray', '2,2');

        // SYSTÈME DRAG & DROP
        let isDragging = false;
        let startMouseX, startMouseY, startLabelX, startLabelY;

        label.addEventListener('mousedown', (e) => {
            isDragging = true;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            startLabelX = parseInt(label.style.left);
            startLabelY = parseInt(label.style.top);

            // ✅ Effet de drag plus subtil
            label.style.boxShadow = '0 3px 8px rgba(231, 76, 60, 0.2)';
            label.style.zIndex = '2000';
            label.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startMouseX;
            const dy = e.clientY - startMouseY;

            const newX = startLabelX + dx;
            const newY = startLabelY + dy;

            label.style.left = newX + 'px';
            label.style.top = newY + 'px';

            updateConnector();
        });

        document.addEventListener('mouseup', (e) => {
            if (!isDragging) return;

            // ✅ Détecter si c'est un click (pas de mouvement) ou un drag
            const dx = e.clientX - startMouseX;
            const dy = e.clientY - startMouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const isClick = distance < 5; // Si mouvement < 5px, c'est un click

            isDragging = false;

            label.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
            label.style.zIndex = '1000';
            label.style.cursor = 'grab';

            // ✅ Si c'est un click, ouvrir le tooltip
            if (isClick) {
                // Trouver le point (marker) correspondant
                const markers = document.querySelectorAll('.event-marker.t1');
                const marker = Array.from(markers).find(m => {
                    const markerEvent = timelineData.timeline_1_events[parseInt(m.dataset.index)];
                    return markerEvent && markerEvent.event_id === data.event.event_id;
                });

                if (marker) {
                    // Simuler un click sur le marker pour ouvrir le tooltip
                    marker.click();
                }
            } else {
                // Si c'est un drag, sauvegarder la position
                const currentPositions = JSON.parse(localStorage.getItem('t1LabelsPositions') || '{}');
                currentPositions[data.index] = {
                    x: parseInt(label.style.left),
                    y: parseInt(label.style.top)
                };
                localStorage.setItem('t1LabelsPositions', JSON.stringify(currentPositions));

                console.log(`[DRAG] Label ${data.index} position saved:`, currentPositions[data.index]);
            }
        });

        labelContainer.appendChild(label);
        svg.appendChild(path);
        // ✅ Pas de cercle - on utilise les points T1 existants

        // Appeler updateConnector APRÈS l'ajout au DOM avec requestAnimationFrame
        // pour s'assurer que le layout est calculé
        requestAnimationFrame(() => {
            updateConnector();
        });
    });

    console.log(`[LABELS-T1] Drew ${placements.length} floating labels`);
}

// Labels flottants pour événements T2 (point de vue suisse) - SEULEMENT pour les markers affichés
function drawFloatingLabelsT2(minDate, maxDate, segments) {
    console.log('[LABELS-T2] Drawing floating labels for T2 events');

    // Vérifier si T2 est activé
    const showT2 = document.getElementById('show-t2')?.checked;
    if (!showT2) {
        console.log('[LABELS-T2] T2 is disabled, skipping labels');
        // Supprimer le conteneur existant si présent
        const existingContainer = document.getElementById('floating-labels-t2');
        if (existingContainer) {
            existingContainer.remove();
        }
        return;
    }

    // Vérifier si le mode "déplier sources" est activé
    const expandSources = document.getElementById('expand-sources')?.checked;
    if (expandSources) {
        console.log('[LABELS-T2] Expand sources mode enabled, skipping labels');
        // Supprimer le conteneur existant si présent
        const existingContainer = document.getElementById('floating-labels-t2');
        if (existingContainer) {
            existingContainer.remove();
        }
        return;
    }

    // ✅ Récupérer les markers T2 RÉELLEMENT affichés dans le DOM
    const t2Markers = document.querySelectorAll('.event-marker.t2');

    if (t2Markers.length === 0) {
        console.log('[LABELS-T2] No T2 markers found in DOM');
        return;
    }

    console.log(`[LABELS-T2] Found ${t2Markers.length} T2 markers in DOM`);

    // ✅ Récupérer les event_ids de T1 pour exclure les doublons
    const t1Events = timelineData.timeline_1_events || [];
    const t1EventIds = new Set(t1Events.map(e => e.event_id));

    // ✅ Extraire les événements depuis les markers affichés, en excluant ceux de T1 ET les post-guerre
    const eventsFromMarkers = Array.from(t2Markers)
        .map(marker => {
            const index = parseInt(marker.dataset.index);
            const event = timelineData.timeline_2_swiss_view[index];
            return event ? { event, marker } : null;
        })
        .filter(item => item !== null
                && !t1EventIds.has(item.event.event_id)
                && !item.event.is_postwar_reconstruction);

    console.log(`[LABELS-T2] ${eventsFromMarkers.length} T2 events after excluding T1 duplicates`);

    if (eventsFromMarkers.length === 0) {
        console.log('[LABELS-T2] No T2-only events to label');
        return;
    }

    // Créer ou récupérer le conteneur pour les labels
    const timeline = document.getElementById('timeline');
    let labelContainer = document.getElementById('floating-labels-t2');

    if (!labelContainer) {
        labelContainer = document.createElement('div');
        labelContainer.id = 'floating-labels-t2';
        labelContainer.style.position = 'absolute';
        labelContainer.style.top = '0';
        labelContainer.style.left = '0';
        labelContainer.style.width = '100%';
        labelContainer.style.height = '100%';
        labelContainer.style.pointerEvents = 'none';
        labelContainer.style.zIndex = '100';
        timeline.appendChild(labelContainer);
    } else {
        labelContainer.innerHTML = '';
    }

    // Créer ou récupérer le SVG pour les lignes de connexion
    let svg = document.getElementById('label-connectors-t2');

    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'label-connectors-t2';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '95';
        timeline.appendChild(svg);
    } else {
        svg.innerHTML = '';
    }

    // ✅ Préparer les données depuis les markers affichés
    const labelData = eventsFromMarkers.map((item, idx) => {
        const { event, marker } = item;

        // ✅ Récupérer la position X depuis le marker existant
        const markerRect = marker.getBoundingClientRect();
        const timelineRect = document.getElementById('timeline').getBoundingClientRect();
        const x = markerRect.left - timelineRect.left + (markerRect.width / 2);
        const y = 200; // Ligne T2 est à y=200

        // Extraire les informations
        const title = event.description || 'N/A';
        const shortTitle = title.length > 35 ? title.substring(0, 35) + '...' : title;

        // ✅ Utiliser event_type_fr depuis les données (déjà traduit)
        const eventType = event.event_type_fr || 'Événement';

        // ✅ Utiliser place_name depuis les données (déjà extrait)
        const location = event.place_name && event.place_name !== 'n.c.' ? event.place_name : '';

        const date = formatDate(event.date_start);

        return {
            event,
            marker,
            x,
            y,
            title: shortTitle,
            eventType,
            location,
            date,
            index: idx
        };
    });

    // ✅ Pas besoin de déduplication - les markers sont déjà dédupliqués par renderTrack
    console.log(`[LABELS-T2] ${labelData.length} labels to create`);

    // Algorithme de placement harmonieux BI-DIRECTIONNEL
    // ✅ Paramètres adaptatifs selon l'appareil
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;

    const viewportWidth = Math.max(screenWidth - 40, 800);
    const labelWidth = isMobile ? 200 : (isTablet ? 240 : 280);
    const labelHeight = 25;
    const minHorizontalGap = isMobile ? 15 : 25;
    const rowHeight = 30;
    const maxRowsBelow = 2;
    const maxRowsAbove = 2;

    // Trier par position X
    labelData.sort((a, b) => a.x - b.x);

    // Placement
    const placements = [];
    const rowsBelow = [];
    const rowsAbove = [];

    labelData.forEach((data, i) => {
        const eventX = data.x;
        const offsetRight = 5;

        let labelStartX = eventX + offsetRight;
        let labelEndX = labelStartX + labelWidth;

        if (labelEndX > viewportWidth) {
            labelEndX = eventX - offsetRight;
            labelStartX = labelEndX - labelWidth;
            if (labelStartX < 0) {
                labelStartX = 0;
                labelEndX = labelWidth;
            }
        }
        if (labelStartX < 0) {
            labelStartX = 0;
            labelEndX = labelWidth;
        }

        const finalStartX = labelStartX;
        const finalEndX = labelEndX;

        const hasCollisionOnRow = (row) => {
            for (const existing of row) {
                if ((finalStartX < existing.maxX + minHorizontalGap) &&
                    (finalEndX > existing.minX - minHorizontalGap)) {
                    return true;
                }
            }
            return false;
        };

        let rowIndex = 0;
        let foundRow = false;
        let isAbove = false;

        const preferAbove = (i % 2 === 0);

        if (preferAbove) {
            while (!foundRow && rowIndex < maxRowsAbove) {
                if (!rowsAbove[rowIndex]) {
                    rowsAbove[rowIndex] = [];
                }

                if (!hasCollisionOnRow(rowsAbove[rowIndex])) {
                    rowsAbove[rowIndex].push({ minX: finalStartX, maxX: finalEndX });
                    foundRow = true;
                    isAbove = true;
                } else {
                    rowIndex++;
                }
            }

            if (!foundRow) {
                rowIndex = 0;
                while (!foundRow && rowIndex < maxRowsBelow) {
                    if (!rowsBelow[rowIndex]) {
                        rowsBelow[rowIndex] = [];
                    }

                    if (!hasCollisionOnRow(rowsBelow[rowIndex])) {
                        rowsBelow[rowIndex].push({ minX: finalStartX, maxX: finalEndX });
                        foundRow = true;
                        isAbove = false;
                    } else {
                        rowIndex++;
                    }
                }
            }
        } else {
            while (!foundRow && rowIndex < maxRowsBelow) {
                if (!rowsBelow[rowIndex]) {
                    rowsBelow[rowIndex] = [];
                }

                if (!hasCollisionOnRow(rowsBelow[rowIndex])) {
                    rowsBelow[rowIndex].push({ minX: finalStartX, maxX: finalEndX });
                    foundRow = true;
                    isAbove = false;
                } else {
                    rowIndex++;
                }
            }

            if (!foundRow) {
                rowIndex = 0;
                while (!foundRow && rowIndex < maxRowsAbove) {
                    if (!rowsAbove[rowIndex]) {
                        rowsAbove[rowIndex] = [];
                    }

                    if (!hasCollisionOnRow(rowsAbove[rowIndex])) {
                        rowsAbove[rowIndex].push({ minX: finalStartX, maxX: finalEndX });
                        foundRow = true;
                        isAbove = true;
                    } else {
                        rowIndex++;
                    }
                }
            }
        }

        if (!foundRow) {
            console.warn(`[LABELS-T2] Could not place label for event at x=${eventX}`);
            return;
        }

        const yOffset = isAbove ? -(rowIndex + 1) * rowHeight : (rowIndex + 1) * rowHeight;
        const labelX = finalStartX;
        const labelY = data.y + yOffset;

        placements.push({
            data,
            x: labelX,
            y: labelY,
            isAbove,
            rowIndex
        });
    });

    // Charger positions sauvegardées
    const savedPositions = JSON.parse(localStorage.getItem('t2LabelsPositions') || '{}');

    // Créer les labels
    placements.forEach((placement) => {
        const { data, x, y, isAbove, rowIndex } = placement;
        const yOffset = isAbove ? -rowHeight : rowHeight;
        const labelX = x;

        // Vérifier si position sauvegardée existe
        const savedPos = savedPositions[data.index];
        const isValidSavedPos = savedPos && Math.abs(savedPos.y - data.y) > 20;
        const finalLabelY = isValidSavedPos ? savedPos.y : (data.y + yOffset);
        const finalLabelX = isValidSavedPos ? savedPos.x : labelX;

        // Créer le label
        const label = document.createElement('div');
        label.style.position = 'absolute';
        label.style.left = finalLabelX + 'px';
        label.style.top = finalLabelY + 'px';
        label.style.display = 'inline-block';
        label.style.maxWidth = '300px';
        label.style.padding = '3px 5px';
        // ✅ Couleurs T2 (bleu au lieu de rouge)
        label.style.background = 'rgba(102, 126, 234, 0.1)'; // Bleu très discret
        label.style.borderRadius = '2px';
        label.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
        label.style.border = '1px solid rgba(102, 126, 234, 0.15)'; // Bordure bleue
        label.style.pointerEvents = 'auto';
        label.style.cursor = 'pointer';
        label.style.fontSize = '8px';
        label.style.lineHeight = '1.2';
        label.style.userSelect = 'none';
        label.style.zIndex = '1000';
        label.style.transition = 'all 0.2s ease';
        label.dataset.eventIndex = data.index;

        // ✅ Créer le label avec eventType et place_name
        const fullTitle = data.location
            ? `${data.eventType} - ${data.location}`
            : `${data.eventType} n.c`;

        label.innerHTML = `
            <div style="font-weight: 400; color: rgba(102, 126, 234, 0.85); font-size: 8px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${fullTitle}
            </div>
        `;

        // ✅ Effet hover
        label.addEventListener('mouseenter', () => {
            if (!isDragging) {
                label.style.background = 'rgba(102, 126, 234, 0.15)';
                label.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
                label.style.borderColor = 'rgba(102, 126, 234, 0.3)';
                label.style.cursor = 'grab';
            }
        });

        label.addEventListener('mouseleave', () => {
            if (!isDragging) {
                label.style.background = 'rgba(102, 126, 234, 0.1)';
                label.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
                label.style.borderColor = 'rgba(102, 126, 234, 0.15)';
                label.style.cursor = 'pointer';
            }
        });

        // Créer la ligne de connexion (pas de cercle - utilise les points existants)
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        const updateConnector = () => {
            const labelRect = label.getBoundingClientRect();
            const containerRect = labelContainer.getBoundingClientRect();

            const currentLabelX = labelRect.left - containerRect.left + labelRect.width / 2;
            const currentLabelY = labelRect.top - containerRect.top;

            const startX = data.x;
            const startY = data.y;
            const endX = currentLabelX;

            const labelIsBelow = currentLabelY > startY;
            const endY = labelIsBelow ? currentLabelY : (currentLabelY + labelRect.height);

            const controlY = (startY + endY) / 2;
            const pathD = `M ${startX} ${startY} Q ${startX} ${controlY}, ${endX} ${endY}`;
            path.setAttribute('d', pathD);
            path.style.display = 'block';
        };

        // ✅ Ligne bleue au lieu de rouge
        path.setAttribute('stroke', '#667eea');
        path.setAttribute('stroke-width', '1');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.25');
        path.setAttribute('stroke-dasharray', '2,2');

        // SYSTÈME DRAG & DROP
        let isDragging = false;
        let startMouseX, startMouseY, startLabelX, startLabelY;

        label.addEventListener('mousedown', (e) => {
            isDragging = true;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            startLabelX = parseInt(label.style.left);
            startLabelY = parseInt(label.style.top);

            label.style.boxShadow = '0 3px 8px rgba(102, 126, 234, 0.2)';
            label.style.zIndex = '2000';
            label.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startMouseX;
            const dy = e.clientY - startMouseY;

            const newX = startLabelX + dx;
            const newY = startLabelY + dy;

            label.style.left = newX + 'px';
            label.style.top = newY + 'px';

            updateConnector();
        });

        document.addEventListener('mouseup', (e) => {
            if (!isDragging) return;

            // Détecter si c'est un click ou un drag
            const dx = e.clientX - startMouseX;
            const dy = e.clientY - startMouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const isClick = distance < 5;

            isDragging = false;

            label.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
            label.style.zIndex = '1000';
            label.style.cursor = 'grab';

            // ✅ Si c'est un click, ouvrir le tooltip
            if (isClick) {
                // ✅ Utiliser directement le marker associé
                if (data.marker) {
                    data.marker.click();
                }
            } else {
                // Si c'est un drag, sauvegarder la position
                const currentPositions = JSON.parse(localStorage.getItem('t2LabelsPositions') || '{}');
                currentPositions[data.index] = {
                    x: parseInt(label.style.left),
                    y: parseInt(label.style.top)
                };
                localStorage.setItem('t2LabelsPositions', JSON.stringify(currentPositions));

                console.log(`[DRAG-T2] Label ${data.index} position saved:`, currentPositions[data.index]);
            }
        });

        labelContainer.appendChild(label);
        svg.appendChild(path);
        // ✅ Pas de cercle - on utilise les points T2 existants

        requestAnimationFrame(() => {
            updateConnector();
        });
    });

    console.log(`[LABELS-T2] Drew ${placements.length} floating labels`);
}

// Grille avec traits verticaux PAR MOIS (même si segments = jours)
function renderGrid(minDate, maxDate, segments) {
    let html = '<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">';

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    // Regrouper les segments par mois pour trouver le début de chaque mois
    const monthStarts = new Map();

    segments.forEach(seg => {
        const monthKey = `${seg.year}-${seg.month}`;

        if (!monthStarts.has(monthKey)) {
            monthStarts.set(monthKey, {
                year: seg.year,
                month: seg.month,
                xStart: seg.xStart
            });
        }
    });

    // Dessiner les traits et labels de mois
    Array.from(monthStarts.values()).forEach(monthData => {
        const { year, month, xStart } = monthData;
        const isJan = month === 0;

        // Trait vertical pour chaque mois
        html += `<div style="position: absolute; left: ${xStart}px; top: 30px; bottom: 0; width: ${isJan ? '2px' : '1px'}; background: ${isJan ? '#000' : '#ddd'};"></div>`;

        // Label année en janvier
        if (isJan) {
            html += `<div style="position: absolute; left: ${xStart + 5}px; top: 5px; font-weight: bold; font-size: 18px; color: #000;">${year}</div>`;
        } else {
            // Label mois pour tous les autres mois
            html += `<div style="position: absolute; left: ${xStart + 5}px; top: 5px; font-size: 12px; color: #666;">${monthNames[month]}</div>`;
        }
    });

    // Ajouter les numéros de jour pour chaque segment
    segments.forEach(seg => {
        const dayNum = seg.day;
        const xCenter = seg.xStart + (seg.width / 2);

        // Petit label de jour sous les labels de mois
        html += `<div style="position: absolute; left: ${xCenter - 10}px; top: 25px; font-size: 9px; color: #999; text-align: center; width: 20px;">${dayNum}</div>`;
    });

    html += '</div>';
    return html;
}

// Calculer la marge d'incertitude en pixels
function getUncertaintyMarginPx(datePrecision, segments) {
    // Marges en jours selon le type d'incertitude
    const marginsInDays = {
        'exact': 0,
        'interval': 30,
        'open_start': 60,
        'open_end': 60,
        'unknown': 90
    };

    const days = marginsInDays[datePrecision] || 15;

    // Convertir jours en pixels (approximation: utiliser segment moyen)
    const avgSegmentWidth = segments.reduce((sum, s) => sum + s.width, 0) / segments.length;
    const avgSegmentDays = 30; // 1 mois par segment
    const pxPerDay = avgSegmentWidth / avgSegmentDays;

    return days * pxPerDay;
}

// 🎨 ENCODAGE VISUEL DE LA TRIPLE INCERTITUDE
function getTripleUncertaintyVisual(event, baseColor, type) {
    // DIMENSION 1: ÉPISTÉMIQUE - Confidence (COULEUR + OPACITÉ)
    let color = baseColor;
    let opacity = 1.0;
    let borderStyle = 'none';

    // POUR T2 : Logique révisée historique
    if (type === 't2') {
        const evidenceType = event.evidence_type || '';
        const confidence = event.confidence || '';
        const quote = (event.source_quote || '').toLowerCase();
        const desc = (event.description || '').toLowerCase();

        // Détection sémantique incertitude (bilingue FR/DE)
        const uncertaintyKeywordsFr = ['vraisemblable', 'probable', 'possible', 'devrait', 'pourrait', 'serait', 'aurait', 'peut-être', 'sans doute'];
        const uncertaintyKeywordsDe = ['wahrscheinlich', 'möglich', 'vermutlich', 'könnte', 'sollte', 'wäre', 'vielleicht', 'eventuell'];
        const hasUncertainty = uncertaintyKeywordsFr.some(kw => quote.includes(kw) || desc.includes(kw)) ||
                               uncertaintyKeywordsDe.some(kw => quote.includes(kw) || desc.includes(kw));

        // FILTRER événements de synthèse avec intervalles longs
        // Critère 1: date_precision = 'interval' ET durée > 6 mois
        // Critère 2: Post-guerre avec période longue dans description

        const isPostwar = evidenceType.includes('postwar_summary') ||
                         evidenceType.includes('postwar_testimony') ||
                         evidenceType.includes('administrative_review');

        if (!event._synthesisChecked) {
            event._synthesisChecked = true;

            // CRITÈRE 1: Vérifier durée réelle de l'intervalle
            if (event.date_precision === 'interval' && event.date_start && event.date_end) {
                const start = new Date(event.date_start);
                const end = new Date(event.date_end);
                const monthsDiff = (end - start) / (1000 * 60 * 60 * 24 * 30);

                if (monthsDiff > 6) {
                    console.log(`[SYNTHESIS DETECT] Interval long détecté: ${monthsDiff.toFixed(1)} mois (${event.date_start} → ${event.date_end})`);
                    console.log(`   Description: ${desc.substring(0, 80)}...`);
                    event._isSynthesisEvent = true;
                    event._synthesisReason = `Intervalle ${monthsDiff.toFixed(1)} mois`;
                }
            }

            // CRITÈRE 2: Post-guerre avec période longue dans description (ancien code)

            if (isPostwar && !event._isSynthesisEvent) {
                // Détecter mention d'une période longue dans la description
                const periodPattern = /(19\d{2})[^\d]*(19\d{2})|(\d{2,3})\s*mois/;
                const periodMatch = desc.match(periodPattern);

                if (periodMatch) {
                    const eventYear = event.date_start ? parseInt(event.date_start.substring(0, 4)) : null;
                    const months = periodMatch[3] ? parseInt(periodMatch[3]) : null;

                    // Détecter mentions de longues durées (>=12 mois)
                    if (months && months >= 12) {
                        console.log(`[SYNTHESIS DETECT] ${months} mois dans description: ${desc.substring(0, 60)}`);
                        event._isSynthesisEvent = true;
                        event._synthesisReason = `Description mentionne ${months} mois`;
                    }
                    // OU si période couvre plusieurs années
                    else {
                        const year1 = periodMatch[1] ? parseInt(periodMatch[1]) : null;
                        const year2 = periodMatch[2] ? parseInt(periodMatch[2]) : null;

                        if (year1 && year2 && eventYear && (year2 - year1) >= 2) {
                            if (Math.abs(eventYear - year2) <= 1) {
                                console.log(`[SYNTHESIS DETECT] Période ${year1}-${year2}, event=${eventYear}: ${desc.substring(0, 60)}`);
                                event._isSynthesisEvent = true;
                                event._synthesisReason = `Période ${year1}-${year2}`;
                            }
                        }
                    }
                }
            }
        }

        // RECONSTITUTIONS POST-GUERRE → NOIR (toggle séparé)
        if (isPostwar) {
            color = '#2c3e50'; // Noir/gris foncé
            opacity = 0.6;
        }
        // ORANGE (peu sûr) : confidence medium/low OU incertitude sémantique
        else if (confidence === '#confidence/medium' ||
                 confidence === '#confidence/low' ||
                 hasUncertainty) {
            color = '#e67e22'; // Orange
            opacity = confidence === '#confidence/low' ? 0.5 : 0.7;

            // Bordure pointillée si incertitude sémantique détectée
            if (hasUncertainty) {
                borderStyle = '2px dashed #d35400';
            }
        }
        // BLEU STANDARD (fiable) : confidence high + sources contemporaines/reported
        else if (confidence === '#confidence/high') {
            color = '#3498db'; // Bleu standard
            opacity = 0.9;
        }
    } else {
        // POUR T1, T3, T4 : Logique originale
        if (event.confidence === '#confidence/high') {
            opacity = 1.0;
        } else if (event.confidence === '#confidence/medium') {
            opacity = 0.7;
        } else if (event.confidence === '#confidence/low') {
            opacity = 0.4;
        }
    }

    // DIMENSION 2: FORME - Simplifié : cercles pleins uniquement
    const size = 10;
    const borderRadius = '50%';

    // DIMENSION 3: TEMPORELLE - Date Precision (BARRE déjà gérée séparément)
    // La barre d'incertitude est ajoutée dans renderTrack()

    // Construction du style CSS - Cercle plein simple
    let style = `width: ${size}px; height: ${size}px; background: ${color}; opacity: ${opacity}; border-radius: ${borderRadius};`;
    if (borderStyle !== 'none') {
        style += ` border: ${borderStyle};`;
    }

    return {
        style: style,
        content: '' // Pas de contenu HTML interne (forme pure CSS)
    };
}

// Timeline compacte avec segments et texte 2x plus grand
function renderTrack(label, events, color, type, minDate, maxDate, segments, trackIndex, expandSources = false) {
    // Événements à rendre
    let eventsToRender = [];

    // IMPORTANT: Cette section détermine quels événements afficher
    // Chaque cas est mutuellement exclusif pour éviter les doublons

    if (expandSources && (type === 't1' || type === 't2')) {
        // CAS 1: Mode déplié T1/T2 - afficher TOUS les événements sans déduplication (y compris post-guerre)
        eventsToRender = events.map((event, index) => ({ event, index }));
    } else if (type === 't1') {
        // CAS 2: Mode normal T1 - déduplication simple par event_id
        const seenIds = new Set();
        events.forEach((event, index) => {
            const eventId = event.event_id;
            if (eventId && !seenIds.has(eventId)) {
                seenIds.add(eventId);
                eventsToRender.push({ event, index });
            } else if (!eventId) {
                eventsToRender.push({ event, index });
            }
        });
    }
    // ATTENTION: Ne PAS mettre de else ici, car T2 se traite plus bas après la déf. des fonctions

    // Espacement variable entre les tracks - DYNAMIQUE en mode déplié
    let spacing;
    if (trackIndex === 0) {
        // T1: pas d'espacement
        spacing = 0;
    } else if (trackIndex === 1) {
        // T2: espace après T1
        if (expandSources) {
            // Mode déplié: adapter selon hauteur réelle de T1
            const t1EventCount = timelineData.timeline_1_events.length;
            const t1Height = Math.max(70, t1EventCount * 13);
            spacing = t1Height + 30; // Marge de 30px entre les tracks
        } else {
            // Mode normal: espacement fixe
            spacing = 100;
        }
    } else if (trackIndex === 2) {
        // T3: espace après T2
        if (expandSources) {
            // Mode déplié: adapter selon hauteurs réelles de T1 et T2
            const t1EventCount = timelineData.timeline_1_events.length;
            const t2EventCount = timelineData.timeline_2_swiss_view.length;
            const t1Height = Math.max(70, t1EventCount * 13);
            const t2Height = Math.max(70, t2EventCount * 13);
            spacing = t1Height + t2Height + 60; // Cumul + marges
        } else {
            // Mode normal: espacement fixe
            spacing = 220;
        }
    } else {
        spacing = 358;
    }

    const top = 60 + spacing;

    // Si mode déplié, on a déjà tous les événements. Sinon, appliquer la déduplication
    if (!expandSources && type === 't2') {
        console.log('[T2 RENDER] ═══════════════════════════════════════════════════');
        console.log('[T2 RENDER] Starting T2 track rendering with', events.length, 'events');
        console.log('[T2 RENDER] ═══════════════════════════════════════════════════');
        // T2: Déduplication intelligente avec détection paires annonce/confirmation

        // Fonction pour extraire les mots-clés d'une description (pour similarité sémantique)
        function extractKeywords(description) {
            const desc = (description || '').toLowerCase();
            const keywords = {
                death_sentence: /condamn.*mort|mort|death sentence|zum tode verurteilt|todesstrafe/.test(desc),
                execution: /exécut|vollstreckung|execution/.test(desc),
                suspension: /suspen|aussetz|sursis/.test(desc),
                grace: /grâce|gnade|pardon|recours/.test(desc),
                transfer: /transfert|transfér|verbracht|überstell/.test(desc),
                arrest: /arrêt|arrest|verhaft/.test(desc),
                espionage: /espion|spionage/.test(desc),
                trial: /tribunal|procès|trial|gericht|jugement/.test(desc),
                detention: /détention|prison|gefängnis|haft|incarcér|emprisonn/.test(desc),
                cherche_midi: /cherche-midi/.test(desc),
                la_sante: /la santé|santé/.test(desc),
                paris: /paris/.test(desc),
                inculpation: /inculp|anklage|charge/.test(desc),
                liberation: /libér|befreit|freed|released/.test(desc),
                commutation: /commut|begnad/.test(desc)
            };
            return keywords;
        }

        // Fonction pour calculer la similarité entre deux événements
        function areSimilarEvents(event1, event2) {
            const kw1 = extractKeywords(event1.description);
            const kw2 = extractKeywords(event2.description);

            // 🎯 RÈGLE SPÉCIALE: Condamnation à mort
            // Si les deux événements parlent de condamnation à mort, les grouper automatiquement
            // (c'est clairement le même événement historique avec différentes sources)
            if (kw1.death_sentence && kw2.death_sentence) {
                return true;
            }

            // Compter les mots-clés en commun
            let commonKeywords = 0;
            let totalKeywords = 0;

            Object.keys(kw1).forEach(key => {
                if (kw1[key] || kw2[key]) {
                    totalKeywords++;
                    if (kw1[key] && kw2[key]) {
                        commonKeywords++;
                    }
                }
            });

            // Bonus : si transfer + deportation présents, considérer comme équivalents
            const desc1 = (event1.description || '').toLowerCase();
            const desc2 = (event2.description || '').toLowerCase();
            const bothAboutTransfer = (desc1.match(/transfert|transfér|déport|verbracht/) &&
                                       desc2.match(/transfert|transfér|déport|verbracht/));
            const bothToGermany = (desc1.match(/allemagne|deutschland/) &&
                                   desc2.match(/allemagne|deutschland/));

            if (bothAboutTransfer && bothToGermany) {
                // Bonus : augmenter légèrement la similarité
                commonKeywords += 0.5;
            }

            // Similarité > 60% = même événement
            return totalKeywords > 0 && (commonKeywords / totalKeywords) > 0.6;
        }

        // Étape 1: Grouper par date exacte
        const eventsByDate = {};
        events.forEach((event, index) => {
            const dateKey = event.date_start || 'unknown';
            if (!eventsByDate[dateKey]) {
                eventsByDate[dateKey] = [];
            }
            eventsByDate[dateKey].push({ event, index });
        });

        // Étape 2: Pour chaque date, grouper les événements similaires
        const eventGroups = {};
        let groupCounter = 0;

        Object.entries(eventsByDate).forEach(([date, dateGroup]) => {
            // Détecter paires annonce/confirmation d'abord
            const mediumEvents = dateGroup.filter(e => e.event.confidence === '#confidence/medium');
            const highEvents = dateGroup.filter(e => e.event.confidence === '#confidence/high');

            if (mediumEvents.length > 0 && highEvents.length > 0) {
                for (const mediumItem of mediumEvents) {
                    const quote = (mediumItem.event.source_quote || '').toLowerCase();
                    const desc = (mediumItem.event.description || '').toLowerCase();
                    const isProspective = quote.includes('soll') || quote.includes('devrait') ||
                                         desc.includes('prévu') || desc.includes('prévue');

                    if (isProspective) {
                        highEvents.forEach(highItem => {
                            highItem.event._hasAnnouncement = true;
                            highItem.event._announcementEvent = mediumItem.event;
                        });
                        break;
                    }
                }
            }

            // Grouper par similarité sémantique
            const assigned = new Set();

            dateGroup.forEach((item, i) => {
                if (assigned.has(i)) return;

                const groupKey = `${date}_group_${groupCounter++}`;
                eventGroups[groupKey] = [item];
                assigned.add(i);

                // Trouver tous les événements similaires
                dateGroup.forEach((otherItem, j) => {
                    if (i !== j && !assigned.has(j) && areSimilarEvents(item.event, otherItem.event)) {
                        eventGroups[groupKey].push(otherItem);
                        assigned.add(j);
                    }
                });
            });
        });

        // Étape 2.5: Détecter les séquences de confirmations (ex: La Santé août 1941, mars 1942, avril 1942)
        // Pour afficher une barre d'incertitude épistémique depuis l'événement initial jusqu'à la première confirmation
        // IMPORTANT: Utiliser events directement (pas eventsByDate) pour inclure événements avec date_start=null
        const allEventsForDetection = events.map((event, index) => ({ event, index }));

        console.log('[LA SANTÉ] Total events for detection:', allEventsForDetection.length);
        const nullDateEvents = allEventsForDetection.filter(item => !item.event.date_start);
        console.log('[LA SANTÉ] Events with date_start=null:', nullDateEvents.length);
        const laSanteInAll = allEventsForDetection.filter(item => {
            const desc = (item.event.description || '').toLowerCase();
            return desc.includes('santé') || desc.includes('sante');
        });
        console.log('[LA SANTÉ] Events mentioning santé (before filtering):', laSanteInAll.length);

        // Chercher confirmations CONTEMPORAINES de détention à La Santé
        // (exclure reconstitutions post-guerre ET événements interval trop longs)
        const laSanteEvents = allEventsForDetection.filter(item => {
            const desc = (item.event.description || '').toLowerCase();
            const evidenceType = item.event.evidence_type || '';
            const precision = item.event.date_precision || '';

            const mentionsLaSante = desc.includes('santé') || desc.includes('sante');
            const isContemporary = !evidenceType.includes('postwar_summary') &&
                                  !evidenceType.includes('postwar_testimony') &&
                                  !evidenceType.includes('administrative_review');

            // Exclure événements interval de plus de 6 mois (probablement rétrospectifs)
            let excludeLongInterval = false;
            if (precision === 'interval' && item.event.date_start && item.event.date_end) {
                const start = new Date(item.event.date_start);
                const end = new Date(item.event.date_end);
                const monthsDiff = (end - start) / (1000 * 60 * 60 * 24 * 30);
                excludeLongInterval = monthsDiff > 6;
            }

            return mentionsLaSante && isContemporary && !excludeLongInterval;
        }).sort((a, b) => {
            // Utiliser date_end si date_start n'existe pas (événements open_start)
            const dateA = a.event.date_start || a.event.date_end || '';
            const dateB = b.event.date_start || b.event.date_end || '';
            return dateA.localeCompare(dateB);
        });

        // Chercher l'arrestation (pour détecter début de période d'incertitude)
        const arrestationEvents = allEventsForDetection.filter(item => {
            const desc = (item.event.description || '').toLowerCase();
            return desc.includes('arrest') || desc.includes('arrêt');
        }).sort((a, b) => {
            const dateA = a.event.date_start || a.event.date_end || '';
            const dateB = b.event.date_start || b.event.date_end || '';
            return dateA.localeCompare(dateB);
        });

        if (laSanteEvents.length >= 1 && arrestationEvents.length >= 1) {
            const firstConfirmation = laSanteEvents[0];
            const arrestation = arrestationEvents[0];

            // Vérifier que l'arrestation est AVANT la première confirmation
            const arrestDate = arrestation.event.date_start || arrestation.event.date_end;
            const confirmDate = firstConfirmation.event.date_start || firstConfirmation.event.date_end;

            console.log(`[LA SANTÉ DETECTION] Found ${laSanteEvents.length} La Santé events, ${arrestationEvents.length} arrest events`);
            console.log(`[LA SANTÉ] First confirmation: ${confirmDate} - ${firstConfirmation.event.description.substring(0, 60)}`);
            console.log(`[LA SANTÉ] Arrest: ${arrestDate} - ${arrestation.event.description.substring(0, 60)}`);

            if (arrestDate && confirmDate && arrestDate < confirmDate) {
                firstConfirmation.event._isFirstConfirmation = true;
                firstConfirmation.event._confirmationType = 'la_sante';
                firstConfirmation.event._uncertaintyStartDate = arrestDate;
                firstConfirmation.event._uncertaintyStartEvent = arrestation.event;
                console.log(`[LA SANTÉ] ✅ Epistemic uncertainty bar will be displayed: ${arrestDate} → ${confirmDate}`);
            } else {
                console.log(`[LA SANTÉ] ❌ No bar (dates not in correct order)`);
            }
        } else {
            console.log(`[LA SANTÉ DETECTION] Insufficient events: ${laSanteEvents.length} La Santé, ${arrestationEvents.length} arrests`);
        }

        // Étape 3: Hiérarchie confidence > precision
        const confidenceOrder = {
            '#confidence/high': 3,
            '#confidence/medium': 2,
            '#confidence/low': 1
        };

        const precisionOrder = {
            'exact': 4,
            'circa': 3,
            'open_end': 2,
            'open_start': 2,
            'interval': 1,
            'unknown': 0
        };

        Object.values(eventGroups).forEach(group => {
            // Trier par hiérarchie: confidence > precision
            group.sort((a, b) => {
                const confA = confidenceOrder[a.event.confidence] || 0;
                const confB = confidenceOrder[b.event.confidence] || 0;

                if (confA !== confB) {
                    return confB - confA;
                }

                const precA = precisionOrder[a.event.date_precision] || 0;
                const precB = precisionOrder[b.event.date_precision] || 0;
                return precB - precA;
            });

            // Garder uniquement le premier (meilleure qualité)
            eventsToRender.push(group[0]);
        });
    } else if (type === 't3') {
        // CAS 3: T3 - garder tous les événements sans déduplication
        eventsToRender = events.map((event, index) => ({ event, index }));
    }
    // NOTE: T1 et T2 sont déjà traités au début de la fonction
    // eventsToRender est déjà rempli pour eux, pas besoin de else général

    // Filtrer les événements post-guerre selon le toggle (T1 et T2)
    if ((type === 't1' || type === 't2') && !expandSources) {
        const showPostwar = document.getElementById('show-postwar')?.checked || false;
        if (!showPostwar) {
            const before = eventsToRender.length;
            eventsToRender = eventsToRender.filter(item => !item.event.is_postwar_reconstruction);
            console.log(`[${type.toUpperCase()} POSTWAR] Filtered out ${before - eventsToRender.length} postwar events (toggle OFF)`);
        } else {
            const postwarCount = eventsToRender.filter(item => item.event.is_postwar_reconstruction).length;
            console.log(`[${type.toUpperCase()} POSTWAR] Showing ${postwarCount} postwar events (toggle ON)`);
        }
    }

    // Grouper par position X pour gérer les superpositions
    // En mode déplié, on a juste TOUS les événements (pas de déduplication)
    // MAIS on garde l'empilement vertical pour les événements à la même date
    const positionGroups = {};
    eventsToRender.forEach(({ event, index }) => {
        const timestamp = parseDate(event.date_start);
        if (!timestamp) return;

        const x = Math.round(dateToX(timestamp, segments));

        if (!positionGroups[x]) {
            positionGroups[x] = [];
        }
        positionGroups[x].push({ event, index });
    });

    // Calculer la hauteur du track selon le max d'empilement
    const maxStack = Object.values(positionGroups).reduce((max, group) => Math.max(max, group.length), 0);
    const trackHeight = Math.max(70, maxStack * 13 + 60); // 60px de marge en bas

    // Créer le HTML du track maintenant qu'on a la hauteur
    let html = `<div style="position: absolute; top: ${top}px; left: 0; width: 100%; height: ${trackHeight}px;">`;
    html += `<div style="position: absolute; left: 0; top: -15px; font-size: 22px; font-weight: bold; color: ${color};">${label}</div>`;
    html += `<div style="position: absolute; left: 0; top: 35px; width: 100%; height: 1px; background: #eee;"></div>`;

    // POUR T2 : Trier chaque groupe pour mettre les bleus/orange EN BAS, les noirs AU-DESSUS
    if (type === 't2') {
        Object.keys(positionGroups).forEach(x => {
            positionGroups[x].sort((a, b) => {
                const evidenceA = a.event.evidence_type || '';
                const evidenceB = b.event.evidence_type || '';

                const isPostwarA = evidenceA.includes('postwar_summary') ||
                                   evidenceA.includes('postwar_testimony') ||
                                   evidenceA.includes('administrative_review');

                const isPostwarB = evidenceB.includes('postwar_summary') ||
                                   evidenceB.includes('postwar_testimony') ||
                                   evidenceB.includes('administrative_review');

                // Postwar en dernier (au-dessus visuellement)
                if (isPostwarA && !isPostwarB) return 1;
                if (!isPostwarA && isPostwarB) return -1;
                return 0;
            });
        });
    }

    // Dessiner les événements
    Object.entries(positionGroups).forEach(([x, group]) => {
        // POUR T2 : Appliquer getTripleUncertaintyVisual pour détecter événements de synthèse
        if (type === 't2') {
            console.log(`[T2 PRE-FILTER] Analyse de ${group.length} événements à position x=${x}`);
            group.forEach(item => {
                getTripleUncertaintyVisual(item.event, color, type);
            });
        }

        // POUR T2 : Filtrer les postwar et événements de synthèse AVANT de calculer stackIndex
        let visibleGroup = group;
        if (type === 't2') {
            const showPostwar = document.getElementById('show-postwar')?.checked || false;

            visibleGroup = group.filter(item => {
                // Toujours filtrer les événements de synthèse mal datés
                if (item.event._isSynthesisEvent) {
                    console.log(`[T2 FILTER] Événement de synthèse filtré: ${item.event.description.substring(0, 80)}`);
                    return false;
                }

                // Filtrer les postwar selon le toggle
                if (!showPostwar) {
                    const evidenceType = item.event.evidence_type || '';
                    const isPostwar = evidenceType.includes('postwar_summary') ||
                                     evidenceType.includes('postwar_testimony') ||
                                     evidenceType.includes('administrative_review');
                    if (isPostwar) {
                        return false;
                    }
                }

                return true;
            });
        }

        visibleGroup.forEach((item, stackIndex) => {
            const event = item.event;
            const index = item.index;

            const xPos = parseInt(x);

            // Positionnement vertical: empilement par stackIndex (13px entre chaque événement)
            const yPos = 30 + (stackIndex * 13);

            // 🎨 ENCODAGE VISUEL DE LA TRIPLE INCERTITUDE
            const visual = getTripleUncertaintyVisual(event, color, type);

            // Gestion des intervalles
            if (event.date_precision === 'interval') {
                // T1 : Toujours ignorer les intervalles
                if (type === 't1') {
                    return;
                }

                // T2 : Afficher UNIQUEMENT si toggle "incertitude temporelle" activé
                if (type === 't2') {
                    const showUncertainty = document.getElementById('show-uncertainty')?.checked || false;

                    // Par défaut, ignorer TOUS les intervals (trop lourd)
                    if (!showUncertainty) {
                        return;
                    }

                    // Si toggle activé, afficher l'interval comme barre
                    if (event.date_start && event.date_end) {
                        const startX = dateToX(parseDate(event.date_start), segments);
                        const endX = dateToX(parseDate(event.date_end), segments);
                        const barWidth = Math.abs(endX - startX);

                        // Couleur claire pour reconstitutions
                        const barColor = '#85c1e9';
                        const barOpacity = 0.4;

                        // Barre d'interval
                        html += `<div style="position: absolute; left: ${startX}px; top: ${yPos + 2}px; width: ${barWidth}px; height: 8px;
                                      background: ${barColor}; opacity: ${barOpacity};
                                      border-radius: 4px; z-index: ${90 + stackIndex}; cursor: pointer;"
                                      class="event-marker ${type}"
                                      data-index="${index}"
                                      data-type="${type}"
                                      title="Reconstitution (période incertaine)"></div>`;

                        // Bordures verticales
                        html += `<div style="position: absolute; left: ${startX}px; top: ${yPos}px; width: 2px; height: 12px;
                                      background: ${barColor}; opacity: 0.7; z-index: ${91 + stackIndex};"></div>`;
                        html += `<div style="position: absolute; left: ${endX}px; top: ${yPos}px; width: 2px; height: 12px;
                                      background: ${barColor}; opacity: 0.7; z-index: ${91 + stackIndex};"></div>`;

                        return; // Ne pas afficher de point central
                    }
                }

                // T3, T4 : Ignorer les intervalles
                return;
            }

            // Barre d'incertitude temporelle pour paires annonce/confirmation (T2)
            const showUncertainty = document.getElementById('show-uncertainty')?.checked !== false;
            if (type === 't2' && event._hasAnnouncement && stackIndex === 0 && showUncertainty) {
                // Barre d'incertitude depuis l'annonce (estimé ~2-3 jours avant) jusqu'à l'événement
                const uncertaintyDays = 3; // Estimation : annonce 2-3 jours avant
                const avgSegmentWidth = segments.reduce((sum, s) => sum + s.width, 0) / segments.length;
                const pxPerDay = avgSegmentWidth / 30; // 30 jours par mois
                const barWidth = uncertaintyDays * pxPerDay;

                // Barre gradient orange → bleu (annonce → confirmation) - AGRANDIE pour meilleure visibilité
                html += `<div style="position: absolute; left: ${xPos - barWidth}px; top: ${yPos}px; width: ${barWidth}px; height: 10px;
                          background: linear-gradient(to right, rgba(230, 126, 34, 0.8), rgba(52, 152, 219, 0.9));
                          border-radius: 3px; z-index: 50; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>`;

                // Marqueur pour l'annonce - plus visible
                html += `<div style="position: absolute; left: ${xPos - barWidth - 2}px; top: ${yPos - 2}px; width: 4px; height: 14px;
                          background: rgba(230, 126, 34, 0.9); border-radius: 2px; z-index: 51; box-shadow: 0 1px 2px rgba(0,0,0,0.3);"></div>`;
            }

            // Barre d'incertitude épistémique (première confirmation après période d'ignorance)
            // Note: Rendu une seule fois même si plusieurs événements empilés (vérification via flag)
            if (type === 't2' && event._isFirstConfirmation && event._uncertaintyStartDate && !event._barRendered && showUncertainty) {
                event._barRendered = true; // Marquer pour éviter duplication
                const startDate = parseDate(event._uncertaintyStartDate);
                // Pour événements open_start, utiliser date_end comme référence
                const confirmationDate = event.date_start || event.date_end;
                const endDate = parseDate(confirmationDate);

                console.log(`[LA SANTÉ RENDER] Attempting to render epistemic bar for event: ${event.description.substring(0, 60)}`);
                console.log(`[LA SANTÉ RENDER] Start date: ${event._uncertaintyStartDate}, End date: ${confirmationDate}`);

                if (startDate && endDate) {
                    const startX = dateToX(startDate, segments);
                    // Pour open_start, utiliser date_end pour calculer la position finale
                    const endX = event.date_start ? xPos : dateToX(endDate, segments);
                    const barWidth = Math.abs(endX - startX);

                    console.log(`[LA SANTÉ RENDER] ✅ Rendering bar: startX=${startX}, endX=${endX}, width=${barWidth}, yPos=${yPos}`);

                    // Barre gradient orange → bleu (ignorance → connaissance)
                    html += `<div style="position: absolute; left: ${startX}px; top: ${yPos}px; width: ${barWidth}px; height: 10px;
                              background: linear-gradient(to right, rgba(230, 126, 34, 0.6), rgba(52, 152, 219, 0.8));
                              border-radius: 3px; z-index: 48; box-shadow: 0 1px 3px rgba(0,0,0,0.15);"
                              title="Période d'incertitude épistémique"></div>`;

                    // Marqueur pour le début de l'incertitude (arrestation)
                    html += `<div style="position: absolute; left: ${startX - 2}px; top: ${yPos - 2}px; width: 4px; height: 14px;
                              background: rgba(230, 126, 34, 0.7); border-radius: 2px; z-index: 49;"></div>`;
                } else {
                    console.log(`[LA SANTÉ RENDER] ❌ Cannot render: startDate=${startDate}, endDate=${endDate}`);
                }
            }

            // Barre d'incertitude temporelle optionnelle (pour autres types d'incertitude)
            // DÉSACTIVÉ POUR T2 : logique épistémique remplace logique temporelle classique
            // SAUF pour reconstitutions post-guerre (points uniquement, pas de span)
            const isPostwar = (event.evidence_type || '').includes('postwar') ||
                              (event.evidence_type || '').includes('administrative_review');

            if (type !== 't2' && stackIndex === 0 && event.date_precision && event.date_precision !== 'exact' && !isPostwar && !event._hasAnnouncement) {
                const marginPx = getUncertaintyMarginPx(event.date_precision, segments);
                html += `<div style="position: absolute; left: ${xPos - marginPx}px; top: ${yPos + 3}px; width: ${marginPx * 2}px; height: 4px; background: rgba(0,0,0,0.15); border-radius: 2px; z-index: 50;"></div>`;
            }

            html += `<div class="event-marker ${type}"
                          style="position: absolute; left: ${xPos}px; top: ${yPos}px; ${visual.style} cursor: pointer; z-index: ${100 + stackIndex};"
                          data-index="${index}"
                          data-type="${type}"
                          ${type === 't3' && event.micro_id ? `data-micro-id="${event.micro_id}"` : ''}>
                          ${visual.content}
                     </div>`;
        });
    });

    html += '</div>';
    return html;
}

// Tooltips - CLICK pour rendre persistant
function attachTooltipEvents() {
    document.querySelectorAll('.event-marker').forEach(marker => {
        marker.addEventListener('click', function(e) {
            e.stopPropagation(); // Empêcher propagation

            // Retirer la sélection de tous les markers
            document.querySelectorAll('.event-marker').forEach(m => {
                m.classList.remove('selected');
            });

            // Ajouter la classe selected au marker cliqué
            this.classList.add('selected');

            const type = this.getAttribute('data-type');
            const index = parseInt(this.getAttribute('data-index'));
            showTooltip(e, type, index);
        });
    });
}

// Fermer tooltip si clic en dehors
document.addEventListener('click', function(e) {
    if (!e.target.closest('.event-marker') && !e.target.closest('#tooltip-section')) {
        // Ne pas fermer, juste laisser visible
    }
});

window.showTooltip = function(event, type, index) {
    const datasets = {
        't1': timelineData.timeline_1_events,
        't2': timelineData.timeline_2_swiss_view,
        't3': timelineData.timeline_3_microactions
        // t4 supprimé
    };

    const item = datasets[type][index];
    if (!item) return;

    // Style CSS pour tableaux - COMPACT
    const tableStyle = 'width: 100%; border-collapse: collapse; margin: 0.3rem 0; font-size: 0.8rem;';
    const thStyle = 'background: #f5f5f5; padding: 0.3rem 0.4rem; text-align: left; border: 1px solid #e0e0e0; font-weight: bold; width: 25%; font-size: 0.75rem;';
    const tdStyle = 'padding: 0.3rem 0.4rem; border: 1px solid #e0e0e0; word-wrap: break-word; font-size: 0.8rem;';

    let html = '<div style="max-height: 100%; overflow-y: auto; padding-right: 10px;">';

    // En-tête + Chaîne de provenance sur MÊME LIGNE
    const typeLabels = { 't1': 'T1', 't2': 'T2', 't3': 'T3' };
    html += '<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">';
    html += `<div style="padding: 0.3rem 0.5rem; background: #667eea; color: white; border-radius: 3px; font-size: 0.75rem; font-weight: bold; flex-shrink: 0;">${typeLabels[type]}</div>`;
    html += '<div style="font-size: 0.65rem; color: #999; flex-shrink: 0;">Chaîne:</div>';

    // Fonctions de traduction
    function translateConfidence(conf) {
        const translations = {
            'high': 'Élevée',
            'medium': 'Moyenne',
            'low': 'Faible'
        };
        return translations[conf] || conf;
    }

    function translateEvidenceType(evidenceType) {
        const translations = {
            'direct': 'Direct',
            'direct observation': 'Observation directe',
            'direct_observation': 'Observation directe',
            'victim statement': 'Déclaration victime',
            'victim_statement': 'Déclaration victime',
            'contemporaneous': 'Contemporain',
            'reported': 'Rapporté',
            'postwar testimony': 'Témoignage après-guerre',
            'postwar_testimony': 'Témoignage après-guerre',
            'postwar summary': 'Synthèse après-guerre',
            'postwar_summary': 'Synthèse après-guerre'
        };
        return translations[evidenceType] || evidenceType;
    }

    function translateActionType(actionType) {
        const translations = {
            'information_transmission': 'Transmission info',
            'request': 'Demande',
            'correspondence': 'Correspondance',
            'reporting': 'Rapport',
            'representation': 'Représentation',
            'assistance': 'Assistance',
            'investigation': 'Investigation',
            'acknowledge_receipt': 'Accusé réception',
            'acknowledgment': 'Accusé réception',
            'documentation': 'Documentation',
            'assessment': 'Évaluation',
            'coordination': 'Coordination'
        };
        return translations[actionType] || actionType;
    }

    function translateTagPart(tagPart) {
        const translations = {
            'persecution': 'Persécution',
            'legal': 'Juridique',
            'detention': 'Détention',
            'displacement': 'Déplacement',
            'transfer': 'Transfert',
            'deportation': 'Déportation',
            'arrest': 'Arrestation',
            'communication': 'Communication',
            'intervention': 'Intervention'
        };
        return translations[tagPart] || tagPart;
    }

    function translateDatePrecision(precision) {
        const translations = {
            'exact': 'Exacte',
            'interval': 'Intervalle',
            'open_end': 'Avant date',
            'open_start': 'Après date',
            'circa': 'Circa'
        };
        return translations[precision] || precision;
    }

    // Fonctions pour extraire mots-clés
    function extractAssertionKeywords(item) {
        let keywords = [];

        // Confidence (traduit)
        if (item.confidence) {
            const conf = item.confidence.replace('#confidence/', '');
            keywords.push(translateConfidence(conf));
        }

        // Evidence type (traduit)
        if (item.evidence_type) {
            const ev = item.evidence_type.replace('#evidence_type/', '').replace(/_/g, ' ');
            keywords.push(translateEvidenceType(ev));
        }

        // Actor/recipient pour contexte
        if (item.actor_name) {
            const actor = item.actor_name.split(' ').slice(-1)[0]; // Nom de famille
            keywords.push(actor);
        }

        return keywords.slice(0, 3).join(', '); // Max 3 mots-clés
    }

    function extractEventKeywords(item) {
        let keywords = [];

        // Date
        if (item.date_edtf) {
            keywords.push(item.date_edtf);
        } else if (item.date_start) {
            keywords.push(item.date_start);
        }

        // Tags principaux (traduits)
        if (item.tags) {
            const tagParts = item.tags.split('/');
            if (tagParts.length >= 2) {
                keywords.push(translateTagPart(tagParts[1])); // Ex: "Persécution" de "#persecution/legal/arrest"
            }
            if (tagParts.length >= 3) {
                keywords.push(translateTagPart(tagParts[2])); // Ex: "Juridique"
            }
        }

        // Action type si disponible (traduit)
        if (item.action_type) {
            keywords.push(translateActionType(item.action_type));
        }

        return keywords.slice(0, 3).join(', '); // Max 3 mots-clés
    }

    // CHAÎNE DE PROVENANCE - INLINE (même hauteur pour tous les blocs)
    const boxHeight = '2.2rem'; // Hauteur fixe pour alignement

    // ArchiveDocument avec date (hover pour PDF)
    const docTitle = item.document_title || item.archive || 'N/A';
    const docDate = item.document_date_norm || item.document_date || '';
    const shortDoc = docTitle.length > 20 ? docTitle.substring(0, 20) + '...' : docTitle;
    const pdfFilename = docTitle + '.pdf';

    html += `<div class="pdf-preview-trigger" data-pdf="${pdfFilename}" style="background: #ffe5e5; padding: 0.3rem 0.5rem; border-radius: 3px; height: ${boxHeight}; display: flex; align-items: center; flex: 1; min-width: 0; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#ffd4d4'" onmouseout="this.style.background='#ffe5e5'">`;
    html += `<span style="font-size: 0.65rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${docTitle} (cliquer pour voir le PDF)">📄 ${shortDoc}</span>`;
    // Date supprimée sur demande utilisateur
    html += '</div>';

    html += '<span style="color: #667eea; font-size: 0.7rem; flex-shrink: 0;">→</span>';

    // Assertion
    html += `<div style="background: #e3f2fd; padding: 0.3rem 0.5rem; border-radius: 3px; height: ${boxHeight}; display: flex; align-items: center; flex: 1; min-width: 0;">`;
    const assertionKw = extractAssertionKeywords(item);
    html += `<span style="font-size: 0.65rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${assertionKw}">🔖 ${assertionKw || 'N/A'}</span>`;
    html += '</div>';

    html += '<span style="color: #667eea; font-size: 0.7rem; flex-shrink: 0;">→</span>';

    // Event
    html += `<div style="background: #e8f5e9; padding: 0.3rem 0.5rem; border-radius: 3px; height: ${boxHeight}; display: flex; align-items: center; flex: 1; min-width: 0;">`;
    const eventKw = extractEventKeywords(item);
    html += `<span style="font-size: 0.65rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${eventKw}">⚡ ${eventKw || 'N/A'}</span>`;
    html += '</div>';

    html += '</div>'; // Fermer la ligne titre + chaîne

    // Ligne métadonnées document (De / À / Date)
    if (item.document_sender || item.document_recipient || item.document_date_text) {
        const sender = item.document_sender || 'n/c';
        const recipient = item.document_recipient || 'n/c';
        const dateText = item.document_date_text || 'n/c';

        html += '<div style="background: #f8f9fa; padding: 0.4rem 0.6rem; margin: 0.5rem 0; border-radius: 4px; font-size: 0.75rem; color: #495057; border-left: 3px solid #6c757d;">';
        html += `<strong>Document:</strong> De: <span style="color: #0066cc;">${sender}</span> → À: <span style="color: #0066cc;">${recipient}</span> | Date: <code style="background: #e9ecef; padding: 0.1rem 0.3rem; border-radius: 2px;">${dateText}</code>`;
        html += '</div>';
    }

    // TABLEAU UNIQUE À 6 COLONNES - Optimisation largeur
    const th6Style = 'background: #f5f5f5; padding: 0.3rem 0.4rem; text-align: left; border: 1px solid #e0e0e0; font-weight: bold; font-size: 0.7rem; width: 14%;';
    const td6Style = 'padding: 0.3rem 0.4rem; border: 1px solid #e0e0e0; word-wrap: break-word; font-size: 0.75rem;';

    html += `<table style="${tableStyle}">`;

    // Ligne 1: Archive + Citation + Event ID
    html += '<tr>';
    if (item.archive) {
        html += `<th style="${th6Style}">Cote</th><td style="${td6Style}"><code style="font-size: 0.7rem;">${item.archive}</code></td>`;
    } else {
        html += `<th style="${th6Style}"></th><td style="${td6Style}"></td>`;
    }
    if (item.source_quote) {
        html += `<th style="${th6Style}">Citation</th><td style="${td6Style} font-style: italic;" colspan="3">"${item.source_quote}"</td>`;
    } else {
        html += `<th style="${th6Style}"></th><td style="${td6Style}" colspan="3"></td>`;
    }
    html += '</tr>';

    // Ligne 2: Actor + Recipient + Victim + Agent
    html += '<tr>';
    if (item.actor_name) {
        html += `<th style="${th6Style}">Émetteur</th><td style="${td6Style}">${item.actor_name}</td>`;
    } else {
        html += `<th style="${th6Style}"></th><td style="${td6Style}"></td>`;
    }
    if (item.recipient_name) {
        html += `<th style="${th6Style}">Destinataire</th><td style="${td6Style}">${item.recipient_name}</td>`;
    } else {
        html += `<th style="${th6Style}"></th><td style="${td6Style}"></td>`;
    }
    if (item.victim) {
        html += `<th style="${th6Style}">Victime</th><td style="${td6Style}"><strong>${item.victim}</strong></td>`;
    } else if (item.agent) {
        html += `<th style="${th6Style}">Agent</th><td style="${td6Style}">${item.agent}</td>`;
    } else {
        html += `<th style="${th6Style}"></th><td style="${td6Style}"></td>`;
    }
    html += '</tr>';

    // Ligne 3: Tags + Date EDTF + Description (colspan 2)
    html += '<tr>';
    if (item.tags) {
        html += `<th style="${th6Style}">Tags</th><td style="${td6Style}"><code style="font-size: 0.65rem;">${item.tags}</code></td>`;
    } else {
        html += `<th style="${th6Style}"></th><td style="${td6Style}"></td>`;
    }
    if (item.date_edtf) {
        html += `<th style="${th6Style}">Date EDTF</th><td style="${td6Style}"><code>${item.date_edtf}</code></td>`;
    } else {
        html += `<th style="${th6Style}"></th><td style="${td6Style}"></td>`;
    }
    if (item.description) {
        html += `<th style="${th6Style}">Description</th><td style="${td6Style}" colspan="1">${item.description}</td>`;
    } else {
        html += `<th style="${th6Style}"></th><td style="${td6Style}"></td>`;
    }
    html += '</tr>';

    // Ligne 4: Date precision + Observations + Agent role
    html += '<tr>';
    if (item.date_precision) {
        const precColors = { exact: '#2ecc71', interval: '#f39c12', open_end: '#e74c3c', open_start: '#e74c3c' };
        const color = precColors[item.date_precision] || '#95a5a6';
        const translatedPrecision = translateDatePrecision(item.date_precision);
        html += `<th style="${th6Style}">Précision temp.</th><td style="${td6Style}"><span style="color: ${color}; font-weight: bold;">${translatedPrecision}</span></td>`;
    } else {
        html += `<th style="${th6Style}"></th><td style="${td6Style}"></td>`;
    }
    if (item.observations) {
        html += `<th style="${th6Style}">Observations</th><td style="${td6Style} font-style: italic; color: #555;" colspan="3">${item.observations}</td>`;
    } else if (item.agent_role) {
        html += `<th style="${th6Style}">Agent role</th><td style="${td6Style}"><code>${item.agent_role}</code></td>`;
        html += `<th style="${th6Style}"></th><td style="${td6Style}"></td>`;
    } else {
        html += `<th style="${th6Style}"></th><td style="${td6Style}" colspan="3"></td>`;
    }
    html += '</tr>';

    html += '</table>';

    // Incertitude épistémique (si T2 spécial)
    if (type === 't2' && item._isFirstConfirmation && item._uncertaintyStartEvent) {
        html += '<div style="background: #fff3cd; padding: 1rem; border-radius: 6px; border-left: 4px solid #e67e22; margin: 1.5rem 0;">';
        html += '<h4 style="margin: 0 0 0.5rem 0; color: #e67e22;">Incertitude épistémique détectée</h4>';
        html += '<p style="margin: 0.5rem 0; font-size: 0.9rem;">Première confirmation de localisation après période d\'ignorance des autorités suisses.</p>';
        html += `<p style="margin: 0.5rem 0;"><strong>Période:</strong> ${item._uncertaintyStartDate} → ${item.date_start}</p>`;
        html += '</div>';
    }

    // CHAÎNES DE COMMUNICATION (T3 seulement)
    if (type === 't3' && (item.prev_in_chain?.length > 0 || item.next_in_chain?.length > 0 || item.replies_to?.length > 0)) {
        html += '<div style="margin-top: 1rem; padding: 0.6rem; background: #e8f4fd; border-left: 4px solid #3498db; border-radius: 4px;">';
        html += '<div style="font-weight: bold; color: #2980b9; margin-bottom: 0.4rem; font-size: 0.8rem;">Chaîne de communication</div>';

        // Micro-action précédente
        if (item.prev_in_chain && item.prev_in_chain.length > 0 && item.prev_in_chain[0]) {
            const allMicroActions = timelineData.timeline_3_microactions || [];
            const prevMA = allMicroActions.find(ma => ma.micro_id === item.prev_in_chain[0]);
            if (prevMA) {
                const prevDesc = prevMA.description.length > 70 ? prevMA.description.substring(0, 70) + '...' : prevMA.description;
                html += `<div style="font-size: 0.75rem; margin: 0.3rem 0; padding: 0.3rem; background: white; border-radius: 3px;">`;
                html += `<span style="color: #7f8c8d;">←</span> <strong>Précédent:</strong> `;
                html += `<span style="color: #95a5a6; font-size: 0.7rem;">${prevMA.date_start}</span> `;
                html += `<span style="color: #34495e;">${prevDesc}</span>`;
                html += `</div>`;
            }
        }

        // Micro-action suivante
        if (item.next_in_chain && item.next_in_chain.length > 0 && item.next_in_chain[0]) {
            const allMicroActions = timelineData.timeline_3_microactions || [];
            const nextMA = allMicroActions.find(ma => ma.micro_id === item.next_in_chain[0]);
            if (nextMA) {
                const nextDesc = nextMA.description.length > 70 ? nextMA.description.substring(0, 70) + '...' : nextMA.description;
                html += `<div style="font-size: 0.75rem; margin: 0.3rem 0; padding: 0.3rem; background: white; border-radius: 3px;">`;
                html += `<span style="color: #7f8c8d;">→</span> <strong>Suivant:</strong> `;
                html += `<span style="color: #95a5a6; font-size: 0.7rem;">${nextMA.date_start}</span> `;
                html += `<span style="color: #34495e;">${nextDesc}</span>`;
                html += `</div>`;
            }
        }

        // Réponses à
        if (item.replies_to && item.replies_to.length > 0 && item.replies_to[0]) {
            const allMicroActions = timelineData.timeline_3_microactions || [];
            const replyMA = allMicroActions.find(ma => ma.micro_id === item.replies_to[0]);
            if (replyMA) {
                const replyDesc = replyMA.description.length > 70 ? replyMA.description.substring(0, 70) + '...' : replyMA.description;
                html += `<div style="font-size: 0.75rem; margin: 0.3rem 0; padding: 0.3rem; background: #fffacd; border-radius: 3px;">`;
                html += `<strong>Répond à:</strong> `;
                html += `<span style="color: #95a5a6; font-size: 0.7rem;">${replyMA.date_start}</span> `;
                html += `<span style="color: #34495e;">${replyDesc}</span>`;
                html += `</div>`;
            }
        }

        html += '</div>';
    }

    // CONTEXTES D'ÉVÉNEMENTS (T3 seulement)
    if (type === 't3' && item.context_events && item.context_events.length > 0) {
        // Filtrer les événements valides (avec event_id non null)
        const validContexts = item.context_events.filter(ctx => ctx.event_id);

        if (validContexts.length > 0) {
            html += '<div style="margin-top: 1rem; padding: 0.6rem; background: #fff8e1; border-left: 4px solid #f39c12; border-radius: 4px;">';
            html += `<div style="font-weight: bold; color: #d68910; margin-bottom: 0.4rem; font-size: 0.8rem;">Événements contextuels (${validContexts.length})</div>`;

            // Afficher les 3 premiers contextes
            validContexts.slice(0, 3).forEach(ctx => {
                const ctxDesc = ctx.event_description.length > 80 ? ctx.event_description.substring(0, 80) + '...' : ctx.event_description;
                html += `<div style="font-size: 0.75rem; margin: 0.3rem 0; padding: 0.3rem; background: white; border-radius: 3px;">`;
                html += `<span style="color: #95a5a6; font-size: 0.7rem;">${ctx.event_date || 'n/c'}</span>: `;
                html += `<span style="color: #34495e;">${ctxDesc}</span>`;
                html += `</div>`;
            });

            if (validContexts.length > 3) {
                html += `<div style="font-size: 0.7rem; color: #95a5a6; font-style: italic; margin-top: 0.3rem;">`;
                html += `... et ${validContexts.length - 3} autre(s) événement(s)`;
                html += `</div>`;
            }

            html += '</div>';
        }
    }

    // ID technique
    if (item.event_id) {
        html += `<div style="margin-top: 1.5rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px; font-size: 0.75rem; color: #666;">
            <strong>ID technique:</strong> <code>${item.event_id}</code>
        </div>`;
    }

    html += '</div>';

    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.innerHTML = html;
        tooltip.className = 'tooltip visible';
        switchTab('tooltip', document.querySelector('.footer-tab'));
    }
};

window.hideTooltip = function() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.className = 'tooltip';
    }
};

// Initialiser le tooltip avec un message d'aide par défaut
function initializeTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #666;">
                <p style="margin: 0; font-size: 0.95rem; line-height: 1.6;">
                    Sélectionnez un événement (point rouge ou bleu) ou une micro-action (point vert) pour voir le détail ici.
                </p>
            </div>
        `;
    }
}

function setupEventListeners() {
    // Forcer le toggle reconstitutions post-guerre à être désactivé par défaut
    const postwarToggle = document.getElementById('show-postwar');
    if (postwarToggle) {
        postwarToggle.checked = false;
    }

    document.getElementById('show-t1').addEventListener('change', renderTimeline);
    document.getElementById('show-t2').addEventListener('change', renderTimeline);
    document.getElementById('show-t3').addEventListener('change', renderTimeline);
    document.getElementById('show-chains').addEventListener('change', renderTimeline);
    document.getElementById('expand-sources').addEventListener('change', renderTimeline);
    document.getElementById('show-postwar').addEventListener('change', renderTimeline);
    document.getElementById('highlight-gaps').addEventListener('change', renderTimeline);
    document.getElementById('show-uncertainty').addEventListener('change', renderTimeline);
    // show-t4 supprimé
}

// Afficher les statistiques
function renderStats() {
    if (!timelineData || !timelineData.statistics) return;

    const stats = timelineData.statistics;
    const statsHtml = `
        <div class="compact-stat">
            <div class="compact-stat-value">${stats.timeline_1_count || 0}</div>
            <div class="compact-stat-label">Événements attestés</div>
        </div>
        <div class="compact-stat">
            <div class="compact-stat-value">${stats.timeline_2_count || 0}</div>
            <div class="compact-stat-label">Vue suisse</div>
        </div>
        <div class="compact-stat">
            <div class="compact-stat-value">${stats.timeline_3_count || 0}</div>
            <div class="compact-stat-label">Micro-actions</div>
        </div>
        <div class="compact-stat">
            <div class="compact-stat-value">${stats.chain_links_count || 0}</div>
            <div class="compact-stat-label">Liens de chaînes</div>
        </div>
        <div class="compact-stat">
            <div class="compact-stat-value">${stats.microactions_with_chains || 0}</div>
            <div class="compact-stat-label">Micro-actions en chaînes</div>
        </div>
        <div class="compact-stat">
            <div class="compact-stat-value">${stats.microactions_with_contexts || 0}</div>
            <div class="compact-stat-label">Micro-actions avec contexte</div>
        </div>
        <div class="compact-stat">
            <div class="compact-stat-value">${stats.timeline_4_count || 0}</div>
            <div class="compact-stat-label">Assertions</div>
        </div>
        <div class="compact-stat">
            <div class="compact-stat-value">${stats.information_gaps_count || 0}</div>
            <div class="compact-stat-label">Trous informatifs</div>
        </div>
        <div class="compact-stat">
            <div class="compact-stat-value">${(stats.quote_first_rate || 0).toFixed(0)}%</div>
            <div class="compact-stat-label">Quote-First</div>
        </div>
    `;
    document.getElementById('stats').innerHTML = statsHtml;
}

window.addEventListener('DOMContentLoaded', () => {
    loadData();

    // Event listener pour le toggle reconstitutions postwar
    document.getElementById('show-postwar')?.addEventListener('change', () => {
        renderTimeline();
    });

    // Event delegation pour les clics sur les triggers PDF
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.pdf-preview-trigger');
        if (trigger) {
            const pdfFilename = trigger.dataset.pdf;
            showPDFModal(pdfFilename);
        }
    });
});

// Fonction pour afficher la modale PDF (VERSION PUBLIQUE - Sans accès aux PDF)
function showPDFModal(pdfFilename) {
    // Créer la modale si elle n'existe pas
    let modal = document.getElementById('pdf-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pdf-modal';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; align-items: center; justify-content: center;';

        const modalContent = document.createElement('div');
        modalContent.style.cssText = 'background: white; max-width: 600px; width: 90%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); display: flex; flex-direction: column;';

        const header = document.createElement('div');
        header.style.cssText = 'padding: 1rem; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; background: #fff3cd;';
        header.innerHTML = '<h3 style="margin: 0; font-size: 1rem; color: #856404;" id="pdf-modal-title">⚠️ Document source non disponible</h3><button id="pdf-modal-close" style="background: #667eea; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Fermer</button>';

        const warningContainer = document.createElement('div');
        warningContainer.id = 'pdf-warning';
        warningContainer.style.cssText = 'padding: 2rem; text-align: center;';
        warningContainer.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
            <h4 style="margin: 0 0 1rem 0; color: #333;">Document archivistique</h4>
            <p style="color: #666; line-height: 1.6; margin-bottom: 1.5rem;">
                Les PDF des sources archivistiques ne peuvent pas être publiés en ligne pour des raisons de droits d'auteur et de protection des archives.
            </p>
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 4px; border-left: 3px solid #667eea;">
                <p style="margin: 0; font-size: 0.9rem; color: #555;">
                    <strong>Document demandé :</strong><br>
                    <span id="pdf-filename" style="font-family: monospace; color: #667eea;"></span>
                </p>
            </div>
            <p style="margin-top: 1.5rem; font-size: 0.85rem; color: #999;">
                Pour consulter les sources originales, veuillez contacter les Archives fédérales suisses.
            </p>
        `;

        modalContent.appendChild(header);
        modalContent.appendChild(warningContainer);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Event listener pour fermer
        document.getElementById('pdf-modal-close').addEventListener('click', closePDFModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closePDFModal();
        });
    }

    // Mettre à jour le nom du fichier dans le warning
    document.getElementById('pdf-filename').textContent = pdfFilename;

    // Afficher la modale
    modal.style.display = 'flex';
}

function closePDFModal() {
    const modal = document.getElementById('pdf-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}
