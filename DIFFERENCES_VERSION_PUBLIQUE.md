# Différences entre version locale et version publique

## 📄 Gestion des PDF sources

### Version locale (développement)
```javascript
// Affiche le PDF dans un iframe
document.getElementById('pdf-iframe').src = `/pdfs/${pdfFilename}`;
```
**Résultat** : Le PDF s'ouvre dans une modale plein écran

### Version publique (GitHub Pages)
```javascript
// Affiche un warning élégant
warningContainer.innerHTML = `
    <div style="font-size: 3rem;">📄</div>
    <h4>Document archivistique</h4>
    <p>Les PDF des sources archivistiques ne peuvent pas être publiés
       en ligne pour des raisons de droits d'auteur...</p>
    <p><strong>Document demandé :</strong> ${pdfFilename}</p>
`;
```

**Résultat visuel** :

```
┌─────────────────────────────────────────────┐
│ ⚠️ Document source non disponible    [Fermer]│
├─────────────────────────────────────────────┤
│                                             │
│                    📄                       │
│                                             │
│         Document archivistique              │
│                                             │
│  Les PDF des sources archivistiques ne      │
│  peuvent pas être publiés en ligne pour     │
│  des raisons de droits d'auteur et de       │
│  protection des archives.                   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Document demandé :                  │   │
│  │ E2001E#1967-113#1605#210_3_2.pdf    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Pour consulter les sources originales,     │
│  veuillez contacter les Archives            │
│  fédérales suisses.                         │
│                                             │
└─────────────────────────────────────────────┘
```

## 🔄 Autres différences

### Fichiers présents

| Fichier | Local | Public | Note |
|---------|-------|--------|------|
| `index.html` | ✅ | ✅ | Identique |
| `timeline-final.js` | ✅ | ✅ | **Modifié** (warning PDF) |
| `data/*.json` | ✅ | ✅ | Identique |
| `pdfs/*.pdf` | ✅ | ❌ | **Exclus** (.gitignore) |
| `timeline_data_extractor.py` | ✅ | ❌ | Outil de build uniquement |
| `config.json` | ✅ | ❌ | Credentials Neo4j |
| Scripts Python | ✅ | ❌ | Outils d'analyse |

### Fonctionnalités

| Fonctionnalité | Local | Public |
|----------------|-------|--------|
| 3 Timelines (T1/T2/T3) | ✅ | ✅ |
| Chaînes de communication | ✅ | ✅ |
| Trous informationnels | ✅ | ✅ |
| Tooltips détaillés | ✅ | ✅ |
| Responsive design | ✅ | ✅ |
| **Affichage PDF sources** | ✅ | ⚠️ Warning |
| Toggles T1/T2/T3 | ✅ | ✅ |
| Labels flottants | ✅ | ✅ |

## 📊 Statistiques

- **Fichiers copiés** : 6 (index.html, timeline-final.js, 2 JSON, 2 README)
- **Modifications** : 1 fonction JavaScript (showPDFModal)
- **Lignes modifiées** : ~50 lignes
- **Taille totale** : ~850 KB (sans PDF)

## ✅ Avantages version publique

1. **100% statique** : Aucun serveur backend requis
2. **GitHub Pages compatible** : Déploiement en 1 clic
3. **Légal** : Pas de violation de droits d'auteur
4. **Transparent** : Warning clair pour les utilisateurs
5. **Toutes fonctionnalités** : Seuls les PDF sont désactivés

## 🚀 Prêt pour déploiement

La version publique est entièrement fonctionnelle et peut être déployée immédiatement sur :
- ✅ GitHub Pages
- ✅ GitLab Pages
- ✅ Netlify
- ✅ Vercel
- ✅ Tout hébergement de fichiers statiques

**Aucune configuration serveur requise !**
