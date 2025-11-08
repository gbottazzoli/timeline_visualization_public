# Timeline Elisabeth Müller 1941-1942 - Version Publique

[![GitHub Pages](https://img.shields.io/badge/demo-live-success)](https://votre-username.github.io/timeline-elisabeth-muller/)

Visualisation interactive du parcours carcéral d'Elisabeth Müller pendant la Seconde Guerre mondiale, modélisée selon la méthodologie **Triple Incertitude** (épistémique, temporelle, attributionnelle).

## 🚀 Déploiement sur GitHub Pages

### Option 1 : Déploiement rapide (recommandé)

1. **Créer un nouveau dépôt sur GitHub**
   - Nom : `timeline-elisabeth-muller` (ou autre)
   - Public ou privé selon votre choix

2. **Initialiser et pousser**
   ```bash
   cd timeline_visualization_public
   git init
   git add .
   git commit -m "Initial commit - Timeline Elisabeth Müller"
   git branch -M main
   git remote add origin https://github.com/VOTRE-USERNAME/timeline-elisabeth-muller.git
   git push -u origin main
   ```

3. **Activer GitHub Pages**
   - Allez dans **Settings** → **Pages**
   - Source : **Deploy from a branch**
   - Branch : **main** → Folder : **/ (root)**
   - Cliquez sur **Save**

4. **Accéder à votre timeline**
   - URL : `https://VOTRE-USERNAME.github.io/timeline-elisabeth-muller/`
   - Le déploiement prend 1-2 minutes

### Option 2 : Intégrer dans un dépôt existant

Si vous voulez ajouter la timeline à un dépôt existant :

```bash
# Copier les fichiers dans votre dépôt
cp -r timeline_visualization_public/* /chemin/vers/votre/repo/

# Ou créer un sous-dossier
mkdir /chemin/vers/votre/repo/timeline
cp -r timeline_visualization_public/* /chemin/vers/votre/repo/timeline/
```

URL d'accès : `https://VOTRE-USERNAME.github.io/votre-repo/timeline/`

## 📁 Structure des fichiers

```
timeline_visualization_public/
├── index.html                    # Page principale
├── timeline-final.js             # Logique de visualisation
├── data/
│   ├── timeline_data.json        # Données des événements
│   └── information_gaps.json     # Trous informationnels
└── README.md                     # Documentation
```

**Tous les fichiers sont nécessaires** - ne supprimez rien !

## ⚠️ Documents sources

Cette version **publique** ne contient pas les PDF des sources archivistiques pour des raisons de droits d'auteur. Lorsqu'un utilisateur clique sur un document source, un avertissement s'affiche :

> "Les PDF des sources archivistiques ne peuvent pas être publiés en ligne pour des raisons de droits d'auteur et de protection des archives."

## 🎨 Fonctionnalités

- **3 Timelines superposées** : T1 (sources directes), T2 (vue diplomatique suisse), T3 (micro-actions)
- **Triple Incertitude** : Visualisation de l'incertitude épistémique, temporelle et attributionnelle
- **Chaînes de communication** : Liens visuels entre micro-actions diplomatiques
- **Trous informationnels** : Périodes sans information fiable
- **Responsive** : Adapté mobile, tablette et desktop
- **Tooltips détaillés** : Citations sources, métadonnées complètes

## 🔧 Configuration avancée

### Domaine personnalisé

1. Créez un fichier `CNAME` à la racine :
   ```
   timeline.votre-domaine.com
   ```

2. Configurez votre DNS :
   - Type : CNAME
   - Nom : timeline
   - Valeur : VOTRE-USERNAME.github.io

### HTTPS

GitHub Pages active automatiquement HTTPS. Si vous utilisez un domaine personnalisé, cochez **Enforce HTTPS** dans Settings → Pages.

## 📊 Architecture technique

- **100% statique** : HTML/CSS/JavaScript pur
- **Pas de backend** : Toutes les données sont pré-calculées dans les JSON
- **Pas de build** : Fonctionne directement, aucune compilation nécessaire
- **Responsive** : Media queries pour 5 breakpoints

## 🛠️ Maintenance

Pour mettre à jour les données :

1. **Localement** : Régénérez les JSON avec `timeline_data_extractor.py` (nécessite Neo4j)
2. Copiez les nouveaux `timeline_data.json` et `information_gaps.json` dans `data/`
3. Committez et poussez :
   ```bash
   git add data/*.json
   git commit -m "Update timeline data"
   git push
   ```

## 📄 Licence et crédits

Cette visualisation a été générée avec [Claude Code](https://claude.com/claude-code).

**Sources** : Archives fédérales suisses (BAR)

## 🐛 Problèmes connus

- Les scrollbars élégantes ne fonctionnent que sur Chrome/Safari (Firefox affiche les barres natives)
- Les media queries responsive nécessitent un hard refresh (Ctrl+Shift+R) après modification

## 📞 Support

Pour toute question sur la méthodologie ou les données, consultez le README principal du projet de recherche.

---

**Version publique** - Déployable sur GitHub Pages sans serveur backend
