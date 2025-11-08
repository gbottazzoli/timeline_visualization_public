# Guide de déploiement GitHub Pages

## ✅ Checklist avant déploiement

- [x] Fichiers essentiels présents :
  - [x] `index.html`
  - [x] `timeline-final.js` (modifié pour warning PDF)
  - [x] `data/timeline_data.json`
  - [x] `data/information_gaps.json`
  - [x] `README.md`

- [x] Modifications appliquées :
  - [x] Warning PDF au lieu de l'affichage
  - [x] `.gitignore` créé

## 🚀 Commandes de déploiement

```bash
# 1. Initialiser le dépôt Git
cd timeline_visualization_public
git init

# 2. Ajouter tous les fichiers
git add .

# 3. Premier commit
git commit -m "feat: Timeline Elisabeth Müller v1.2 - Version publique GitHub Pages

- Visualisation interactive Triple Incertitude
- 3 timelines (T1/T2/T3) + chaînes de communication
- Warning pour documents PDF non publiables
- Responsive mobile/tablette/desktop
- 100% statique, prêt pour GitHub Pages"

# 4. Créer la branche main
git branch -M main

# 5. Ajouter le remote (REMPLACER PAR VOTRE URL)
git remote add origin https://github.com/VOTRE-USERNAME/timeline-elisabeth-muller.git

# 6. Pousser
git push -u origin main
```

## 🌐 Configuration GitHub Pages

1. **Aller sur GitHub** : `https://github.com/VOTRE-USERNAME/timeline-elisabeth-muller`
2. **Settings** → **Pages**
3. **Source** : Deploy from a branch
4. **Branch** : `main` | Folder : `/ (root)`
5. **Save**
6. Attendre 1-2 minutes
7. **Accéder** : `https://VOTRE-USERNAME.github.io/timeline-elisabeth-muller/`

## ✨ Résultat

Votre timeline sera accessible publiquement avec :
- ✅ Toutes les fonctionnalités interactives
- ✅ Responsive mobile/tablette/desktop
- ✅ HTTPS automatique
- ✅ Warning élégant pour les PDF

## 🔒 Important

⚠️ **Ne jamais committer** :
- Les PDF des sources (`pdfs/`)
- Les credentials Neo4j (`config.json`)
- Les scripts Python d'analyse

Ces fichiers sont déjà exclus par `.gitignore`
