# Timeline Elisabeth Müller - Visualisation Triple Incertitude

**Version Production Ready** ✅
**Date**: 2025-11-13

Visualisation interactive du parcours carcéral d'Elisabeth Müller (1941-1945) avec encodage visuel de la triple incertitude (épistémique, temporelle, attributionnelle).

---

## 🚀 Quick Start

```bash
# Lancer la visualisation
./launch_timeline.sh
```

Puis ouvrir dans le navigateur : **http://localhost:8000**

---

## 📊 Données Visualisées

- **T1 - Sources Directes** : 10 événements attestés (rouge)
- **T2 - Vue Diplomatique Suisse** : 70 événements (38 contemporains + 32 post-guerre)
- **T3 - Micro-actions Diplomatiques** : 152 micro-actions (vert)
- **Chaînes de communication** : 97 liens entre micro-actions
- **Trous informationnels** : 2 périodes identifiées

---

## 🎯 Principes Méthodologiques

### Assertion-First
Chaque donnée visualisée est ancrée dans une assertion structurée, extraite et qualifiée selon trois dimensions d'incertitude.

### Quote-First
Chaque assertion contient sa citation textuelle source (couverture 100%). Accessible dans le tooltip de chaque événement pour garantir la traçabilité.

### Triple Incertitude
Modélisation de trois dimensions :
- **Épistémique** : niveau de confiance (opacité des points)
- **Temporelle** : précision des dates (point unique vs barres)
- **Attributionnelle** : type de source (couleur en T2)

---

## 🎨 Encodage Visuel

### Opacité = Confiance épistémique
- **Opaque (100%)** → Confiance élevée : langage affirmatif ("a été condamnée")
- **Semi-transparent (70%)** → Confiance moyenne : ton neutre, rapport indirect
- **Très transparent (40%)** → Confiance faible : conditionnel, doute

### Forme temporelle = Précision de la date
- **Point unique** → Date exacte connue
- **Barre pleine** → Intervalle attesté entre deux dates connues
- **Barre gradient orange→bleu** → Période d'ignorance puis confirmation
- **Barre courte (2-3 jours)** → Écart annonce/réalisation

### Couleur (T2) = Type et fiabilité de la source
- **BLEU** → Sources fiables : confiance élevée + documents contemporains
- **ORANGE** → Sources incertaines : confiance moyenne/faible ou incertitude sémantique
- **NOIR** → Reconstitutions d'après-guerre (Commission 1955-1962)
- **Bordure pointillée** → Incertitude sémantique détectée ("vraisemblable", "möglich")

---

## 🛠️ Architecture Technique

### Backend (Python)
```
timeline_data_extractor.py    - Extraction et enrichissement des données depuis Neo4j
```

**Fonctionnalités** :
- Requêtes Cypher pour T1, T2, T3
- Filtrage documents post-guerre (≥1945)
- Détection incertitude sémantique
- Calcul trous informationnels
- Export JSON enrichi

### Frontend (JavaScript)
```
timeline_visualization/
├── index.html                 - Interface et légende complète
├── timeline-final.js          - Moteur de rendu et interactions
└── data/
    └── timeline_data.json     - Données enrichies (811KB)
```

**Fonctionnalités** :
- Rendu responsive 3 timelines parallèles
- Labels flottants intelligents (algorithme anti-collision)
- Chaînes de communication (courbes Bézier)
- Tooltips enrichis avec citations sources
- Toggles pour filtrage progressif
- Visualisation incertitudes temporelles

---

## 🎮 Options de Visualisation

### Toggles Disponibles
- **T1/T2/T3** : Afficher/masquer chaque timeline
- **Chaînes de communication** : Visualiser les flux diplomatiques
- **Déplier sources** : Mode détaillé avec toutes les assertions
- **Trous informatifs** : Mettre en évidence les périodes sans information
- **Incertitude temporelle** : Afficher les barres d'incertitude
- **Reconstitutions post-guerre** : Inclure les 32 événements après 1945 (OFF par défaut)

### Interactions
- **Clic sur événement** : Affiche tooltip avec citation source, type d'evidence, confiance
- **Survol lien communication** : Highlight de la chaîne complète
- **Drag & drop labels** : Repositionnement manuel avec sauvegarde localStorage
- **Bouton reset labels** : Rétablir placement automatique
- **Resizer timeline/footer** : Ajuster manuellement la proportion entre visualisation et informations (drag vertical + localStorage)

---

## 📋 Workflow de Mise à Jour

### 1. Modifier les données Neo4j
```bash
# Si nécessaire, corriger les données dans Neo4j
# Exemple : correction date La Santé
cypher-shell "MATCH (e:Event {event_id: '...'}) SET e.date_start = null"
```

### 2. Régénérer les données
```bash
python3 timeline_data_extractor.py
```

### 3. Relancer la visualisation
```bash
./launch_timeline.sh
```

Le fichier `timeline_data.json` est automatiquement rechargé.

---

## 🔧 Paramètres Techniques

### Algorithme de placement des labels (timeline-final.js)

**T1 (Sources Directes)** :
- `labelWidth`: 280px
- `rowHeight`: 30px (espacement vertical)
- `maxRowsAbove`: 2 (max 60px au-dessus)
- `maxRowsBelow`: 1 (max 30px en dessous)

**T2 (Vue Suisse)** :
- `labelWidth`: 280px
- `rowHeight`: 30px
- `maxRowsAbove`: 2 (max 60px au-dessus)
- `maxRowsBelow`: 2 (max 60px en dessous)

**Stratégie** : Alternance dessus/dessous + détection collision + fallback intelligent

### Filtrage documents post-guerre

**Backend** (`timeline_data_extractor.py:81-114`) :
```python
def is_post_war_document(self, document_date):
    year = int(str(document_date)[:4])
    if year >= 1945:
        return True
    return False

def is_postwar_evidence_type(self, evidence_type):
    if not evidence_type:
        return False
    evidence_str = str(evidence_type).lower()
    return 'postwar' in evidence_str
```

**Frontend** (`timeline-final.js:2087-2098`) :
- Marquage avec flag `is_postwar_reconstruction`
- Filtrage conditionnel selon toggle `show-postwar`
- Exclusion automatique des labels pour événements post-guerre

---

## 📚 Documentation Complète

### Onglet "Définitions" dans l'interface
L'interface contient une légende complète avec :
- Principes méthodologiques
- Structure des 3 timelines
- Encodage visuel détaillé
- 2 tableaux : Typologie des sources + Précision temporelle
- Objectifs analytiques

### Sessions de développement
Voir `archives/session_notes/` pour l'historique complet des corrections et améliorations :
- `SESSION_2025-11-08_CORRECTIONS_T2_TOGGLES.md` : Corrections T2, toggles, incertitudes temporelles

---

## ✅ Fonctionnalités Validées

### Nouvelles fonctionnalités v1.3 (2025-11-13)
- ✅ **Resizer manuel** : Barre draggable entre timeline et footer
  - Support souris ET tactile (mobile/tablette)
  - Persistance localStorage (hauteur sauvegardée)
  - Contraintes min/max (150px minimum par zone)
  - Responsive : s'adapte au redimensionnement fenêtre
- ✅ **Correction erreur OCR** : 29.12.1941 → 29.03.1941 (arrestation Paris)
  - Corrigé dans JSON (3 événements)
  - Corrigé dans Neo4j (script automatique)
- ✅ **Affichage événements post-guerre** : Points noirs visibles et empilés
  - Détection via `is_postwar_reconstruction` + `evidence_type`
  - Ordre empilement inversé : noirs AU-DESSUS des bleus
  - Exception pour événements critiques (condamnation à mort)
  - Déduplication intelligente : meilleur contemporain + TOUS post-guerre

### Corrections v1.2 (2025-11-08)
- ✅ Filtrage documents post-guerre (38→70 avec toggle)
- ✅ Déduplication condamnation à mort (3→2 points)
- ✅ Correction Neo4j La Santé (ordre chronologique)
- ✅ Synchronisation labels avec toggles T1/T2
- ✅ Toggle trous informatifs fonctionnel
- ✅ Toggle incertitude temporelle corrigé
- ✅ Labels supprimés en mode "déplier sources"
- ✅ Message d'aide initial dans tooltip
- ✅ Légende restructurée et enrichie
- ✅ Toggle post-guerre OFF par défaut
- ✅ Flèches chaînes communication réduites (50%)
- ✅ Labels rapprochés des points (distances réduites 2x)

### Conformité Méthodologique
- ✅ Assertion-First : 100% des événements liés à des assertions
- ✅ Quote-First : 100% des événements avec citation source
- ✅ Triple Incertitude : Encodage complet (épistémique, temporelle, attributionnelle)

---

## 🐛 Debugging

### Console JavaScript
Ouvrir DevTools (F12) pour voir les logs :
```
[LABELS-T1] 10 events total, 8 unique events after dedup
[LABELS-T2] Drew 38 floating labels
[CHAIN-LINKS] Drawing 97 communication links
```

### Vérifier JSON
```bash
python3 -c "import json; d=json.load(open('timeline_visualization/data/timeline_data.json')); print(f'T1:{len(d[\"timeline_1_events\"])} T2:{len(d[\"timeline_2_swiss_view\"])} T3:{len(d[\"timeline_3_microactions\"])}')"
```

### Reset labels positions
Utiliser le bouton "Réinitialiser positions des labels" dans l'onglet Options, ou :
```javascript
localStorage.removeItem('t1LabelsPositions');
localStorage.removeItem('t2LabelsPositions');
```

---

## 📊 Statistiques Finales

| Timeline | Événements | Particularités |
|----------|-----------|----------------|
| **T1** | 10 | Sources directes, haute confiance uniquement |
| **T2** | 38+32 | Vue diplomatique (32 post-guerre avec toggle) |
| **T3** | 152 | Micro-actions + 97 chaînes communication |

**Incertitudes temporelles (T2)** :
- 32 événements `exact` (date précise)
- 24 événements `open_start` (date début inconnue)
- 8 événements `interval` (période attestée)
- 6 événements `open_end` (date fin inconnue)

**Trous informationnels** : 2 périodes identifiées avec absence de documentation

---

## 🚀 Production Ready

**Version** : 1.3
**Date** : 2025-11-13
**Statut** : ✅ Production Ready
**Conformité méthodologique** : 100%

**Nouveautés v1.3** :
- Resizer manuel timeline/footer
- Correction erreur OCR dates arrestation
- Affichage corrigé événements post-guerre (points noirs)

---

## 📞 Support

Pour toute question :
1. Consulter l'onglet "Définitions" dans l'interface
2. Vérifier les notes de session dans `archives/session_notes/`
3. Examiner le code commenté dans `timeline-final.js`
