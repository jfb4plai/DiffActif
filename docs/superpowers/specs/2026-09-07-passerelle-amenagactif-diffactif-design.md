# Passerelle AménagActif → DiffActif — design

**Date :** 2026-09-07
**Statut :** validé, **en pause** jusqu'à confirmation PO de la nomenclature AU (voir §8).
**Objectif :** permettre à un enseignant, en un clic depuis la fiche AU/AR qu'il a déjà reçue, d'obtenir son support de cours converti — version classe + variantes ciblées par aménagement — sans rien ressaisir.

---

## 1. Périmètre

**Dans le périmètre :**
- Chapitre 1 du catalogue AménagActif uniquement : *« SUPPORTS ET DOCUMENTS ÉCRITS, MISE EN PAGE & CONSIGNES »*.
- Transformations **mécaniques / déterministes** seulement. **Aucun appel IA dans la passerelle.**
- Sortie : documents `.docx` éditables.

**Hors périmètre (explicitement) :**
- Les 11 autres chapitres du catalogue.
- Les aménagements libres (`ar_amenagements_libres`) — texte libre, non mécanisable.
- Toute reformulation IA du contenu (reste possible dans le mode autonome de DiffActif, pas ici).
- Les AR non transformables en document (temps supplémentaire, calculatrice, lecture à voix haute…) → listés en rappel, pas appliqués.
- L'import persistant de fiche dans DiffActif (`diff_classes`, `diff_eleves`) — incrément ultérieur « power user », approche B, non retenue pour la v1.

---

## 2. Approche retenue

**A — Entrée depuis la fiche, route publique DiffActif scellée par le token.**

Alternatives écartées :
- **B — Import de fiche dans DiffActif connecté** : plus de setup, persistant, ajustable. Reporté comme incrément.
- **C — AménagActif fait l'adaptation lui-même** : dupliquerait la chaîne Vision + IA + picto guard de DiffActif ; risque de divergence des règles AU (déjà survenu, cf. mémoire `diffactif-pipeline-au`). Rejeté.

---

## 3. Architecture & flux

```
AménagActif — page fiche (FichePublique, token JWT déjà reçu par le prof)
   │  bouton « Adapter un support pour cette classe »
   ▼
diffactif.jfb4plai.com/adapter-classe?src=<token>     route PUBLIQUE, pas de compte
   │  GET https://amenagactif.jfb4plai.com/api/profil-classe?token=<token>
   ▼
   { contexte, auCommuns[ch.1], arClusters[ch.1] }     computeProfilDiffActif() filtré ch.1
   │
   ▼
Écran « Adapter » — mode fiche :
   - contexte pré-rempli, lecture seule (école / classe / année)
   - le prof dépose SON document  →  pipeline Vision→JSON→renderAu() INCHANGÉ
   - DiffActif calcule : 1 doc AU classe  +  k variantes AR (une par cluster)
   - export : .zip = AU_classe.docx + variante_1.docx … variante_k.docx
```

**Principes :**
- **Aucune nouvelle table.** AménagActif expose une route de lecture ; DiffActif ne persiste rien dans ce mode — le token porte tout le contexte.
- **Auth** : le token JWT `{ classeId }` (HS256, `AMENAG_TOKEN_SECRET`, 120 j) EST l'autorisation. Cohérent avec « enseignants sans compte » d'AménagActif. DiffActif conserve son auth propre pour l'usage autonome.
- **Couplage minimal** : une seule dépendance inter-app, la route `/api/profil-classe`. Si AménagActif est indisponible, `/adapter-classe` sans profil exploitable retombe sur l'écran DiffActif standard (dégradation propre, message explicite).
- **RGPD** : le regroupement par cluster se fait côté AménagActif. DiffActif ne reçoit jamais de nom, prénom ou initiale — seulement `arSet` + `nbEleves`.

---

## 4. Contrat de données — route `/api/profil-classe` (AménagActif)

Nouvelle fonction serverless, calquée sur `api/fiche-token.js` (réutilise `verifyFicheToken`, `loadClasseData`).

```
GET /api/profil-classe?token=<jwt>

200 {
  app: "amenagactif",
  version: 1,
  contexte: { ecole: string, classe: string, annee: string },
  auCommuns: [
    { code: string, libelle: string, ordre: number }        // type AU, chapitre 1
  ],
  arClusters: [
    { arSet: string[], nbEleves: number }                    // arParEleve regroupé par jeu d'AR identique, chapitre 1
  ]
}

401 { error: "lien invalide ou expiré" }
```

**Règles de calcul :**
- Filtre chapitre : sur un **code de chapitre stable** (à ajouter au catalogue, ex. `ch_supports`) — pas sur `ordre === 1`, fragile si le PO réordonne. Fallback provisoire : titre normalisé.
- `auCommuns` : items `type === 'AU'` du chapitre 1 sélectionnés au niveau classe (`ar_amenagements_classe`).
- `arClusters` : pour chaque élève, jeu d'AR `type === 'AR'` du chapitre 1 (`ar_selections`) ; deux élèves au même jeu → un seul cluster ; `nbEleves` = compte. Aménagements libres exclus.
- Un cluster vide n'est pas émis. Si aucun AR ch.1 → `arClusters: []`.
- `Cache-Control: private, max-age=60` (comme `fiche-token.js`).

**Réutilisation :** `computeProfilDiffActif()` (`src/domain/projections/profilDiffActif.js`) est étendu ou wrappé pour (a) filtrer chapitre 1, (b) produire `arClusters` au lieu de `arParEleve` nominatif. Le format actuel `arParEleve` reste disponible pour l'usage historique.

---

## 5. Entrée document (DiffActif, mode fiche)

Réutilise `src/lib/extractFile.js` **sans modification** :

| Source | Chemin | Fréquence attendue |
|---|---|---|
| `.docx` | mammoth → texte natif, pas d'OCR | majoritaire |
| `.pdf` natif | pdf.js → texte natif si présent, sinon rendu canvas → Vision | courant |
| scan / photo / `.pdf` image | rendu → Vision OCR (`api/extract.js`) | minoritaire |

Puis chaîne inchangée : texte → `api/_docSchema.js` (JSON typé, `output_config.format`) → `renderAu()`.
Le mode fiche **n'altère pas** cette chaîne ; il ajoute l'étape « variantes » en aval.

---

## 6. Variantes AR & mapping chapitre 1

Fichier unique : `src/lib/arChapitre1.js` — table `libellé canonique catalogue → transformation`.

| AR / AU chapitre 1 | Effet document | État `renderAu()` |
|---|---|---|
| Cours uniquement en recto | saut de page pair forcé, `@page` recto | à ajouter |
| Fournir le cours en A3 | format page A3 à l'export | à ajouter |
| Doubler les espaces de réponse | hauteur / lignes `BLANC` × 2 | partiel |
| Colorer une ligne sur deux dans les tableaux | zébrage tableaux | à ajouter |
| Séquencer les consignes (une consigne = une action) | déjà appliqué (verbe gras, règle 15 mots) | oui |
| Rédiger des consignes sans élément distracteur | déjà appliqué | oui |
| Mettre les consignes en évidence | verbe d'action gras en tête | oui |

**Règles :**
- Une **variante par cluster** reçu. En-tête de variante : `arSet` joint + `— N élèves`. Jamais de nom d'élève.
- Tout libellé **absent de la table** → bloc de rappel en tête de variante : « Aménagements non appliqués automatiquement : … ». Jamais d'omission silencieuse.
- `arClusters` vide → seul le document AU classe est produit.
- `arChapitre1.js` contient les libellés **exacts** du catalogue. Un test échoue si un libellé AR/AU du chapitre 1 catalogue n'a ni entrée de transformation ni entrée de rappel — garde-fou contre la divergence.

---

## 7. Sortie & garde-fou relecture

- Export `.docx` éditable par document via la lib `docx` existante : `exportProfilDocx` généralisé en `exportVarianteDocx({ auTexte, arSet, transformations, rappels, contexte })`.
- Lot = `.zip` : `DiffActif_{classe}_AU-classe.docx` + `DiffActif_{classe}_variante_{slug-arSet}.docx` × k.
- **Case « J'ai relu » bloquante** (pattern Lot D existant) : l'export du lot reste verrouillé tant que la relecture n'est pas cochée sur le document AU classe. Le split 80/20 s'applique même sans IA — la fidélité OCR exige un contrôle humain.
- `pointsAVerifier()` s'exécute sur le doc AU classe et sur chaque variante (amorces illisibles, distracteurs `( a – a )`).

---

## 8. Dépendances & risques

| # | Élément | Impact | Mitigation |
|---|---|---|---|
| 1 | **Nomenclature AU commune aux 2 apps — en attente PO** (mail envoyé 2026-09-07) | Bloque la finalisation de `arChapitre1.js`. La réponse PO doit trancher : (a) liste AU chapitre 1 identique au libellé près entre AménagActif et le référentiel DiffActif ? (b) code stable par item ? | Build contre `catalogue.json` actuel ; renommage PO = édition d'un seul fichier + un test rouge |
| 2 | Réordonnancement des chapitres par le PO | Casse un filtre basé sur `ordre` | Filtrer sur `code` de chapitre stable, à ajouter au catalogue |
| 3 | `MAX_COTE = 1568` couplé au modèle Vision | Hors périmètre passerelle | Déjà documenté côté DiffActif (`extractFile.js`) |
| 4 | `/api/generate` protégé par `requireUser` | Sans objet : la passerelle n'appelle pas l'IA | — |

**~80 % du build est PO-indépendant** (route `/api/profil-classe`, route publique, mode fiche, export zip, transformations mécaniques `renderAu()`). Seule la couche de liaison libellé → transformation est bloquée.

---

## 9. Tests

**AménagActif — `api/profil-classe` + projection :**
- token valide → 200 avec contexte + `auCommuns` + `arClusters`
- token expiré / invalide → 401
- classe sans AR chapitre 1 → `arClusters: []`
- filtre chapitre 1 : un AR d'un autre chapitre n'apparaît pas
- clustering : 2 élèves au même `arSet` → 1 cluster, `nbEleves: 2`
- aucune donnée nominative (prénom / initiale / `referent_plai_nom`) dans la réponse
- aménagements libres exclus

**DiffActif — mode fiche :**
- `arChapitre1.js` : chaque libellé AR/AU du chapitre 1 catalogue a une entrée (transformation ou rappel explicite)
- `renderAu()` + « recto » → sauts de page pairs
- `renderAu()` + « A3 » → format page à l'export
- export zip = 1 + k fichiers, noms attendus
- `/adapter-classe` sans `src` ou token invalide → écran DiffActif standard, message explicite
- case « J'ai relu » non cochée → bouton export lot désactivé

---

## 10. Prochaines étapes

1. **[bloqué]** Réponse PO sur la nomenclature (§8-1).
2. À réception : figer `arChapitre1.js` sur les libellés / codes validés.
3. Passer au plan d'implémentation (`writing-plans`) : découpage en tâches, ordre, TDD.
4. Répartition probable : Tâche A `api/profil-classe` + projection (AménagActif) · Tâche B `arChapitre1.js` + extensions `renderAu()` (DiffActif) · Tâche C route publique `/adapter-classe` + mode fiche · Tâche D `exportVarianteDocx` + zip + garde-fou · Tâche E bouton fiche AménagActif.
