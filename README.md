# TEC Widget

PWA légère pour afficher intelligemment les prochains passages planifiés du réseau TEC sur des trajets favoris.

## Objectif v1.0

- PWA installable sur Android et Windows ;
- trajets favoris persistés localement ;
- sélection automatique du prochain trajet pertinent, y compris le prochain jour actif ;
- consultation rapide Aujourd’hui / Demain / date choisie ;
- périodes Maintenant / Matin / Après-midi / Heure… ;
- affichage configurable de 2 à 5 prochains passages ;
- données GTFS TEC avec cache local ;
- inversion manuelle du trajet affiché ;
- fonctionnement hors ligne avec les dernières données disponibles.

## Cas d’usage initial

Deux profils GTFS sont actuellement préparés :

- ligne 9, arrêt `Belgrade - Rue Laide Coupe`, direction `Jambes` ;
- ligne 9, arrêt `Rue des Combattants`, direction `Flawinne`.

Ils sont exposés par défaut comme `Maison → Travail` et `Travail → Maison`. Le panneau **Mes trajets** permet de renommer les favoris, choisir l’un des profils préparés, définir les jours habituels et l’heure/période de départ. L’index exhaustif des arrêts et lignes TEC reste une évolution ultérieure.

## Mode intelligent

Par défaut, l’application cherche :

1. un trajet habituel encore pertinent maintenant ;
2. sinon le prochain trajet habituel restant aujourd’hui ;
3. sinon le prochain trajet habituel d’un jour actif suivant.

Ainsi, en fin de soirée un jour ouvrable, l’application peut directement afficher le trajet du lendemain matin. Les contrôles de date et de période permettent toujours de corriger ce choix manuellement, puis **Revenir en mode intelligent** restaure l’automatisme.

## Déploiement public

La PWA est publiée via GitHub Pages à l’adresse :

`https://carouan.github.io/TEC_Widget/`

Le workflow **Deploy GitHub Pages** est déclenché à chaque push vers `main` et peut aussi être lancé manuellement. Il valide le prétraitement GTFS, télécharge le feed TEC courant, génère les horaires compacts, construit `dist/` puis publie l’artefact.

## Données GTFS

Le feed officiel TEC est trop volumineux pour être téléchargé directement par la PWA. Le projet le prétraite donc avant déploiement pour produire `public/data/schedules.json`, qui ne contient que les passages utiles aux profils préparés.

Source producteur : `https://opendata.tec-wl.be/Current%20GTFS/TEC-GTFS.zip`.

Pour préparer les données réelles :

```bash
npm run prepare:gtfs
npm run build
```

Le script Python utilise uniquement la bibliothèque standard et traite `stop_times.txt` en streaming. Sans `schedules.json`, l’application conserve volontairement les horaires de démonstration et l’indique explicitement.

## Architecture

L’application reste volontairement sans framework ni dépendance applicative : HTML, CSS, JavaScript et Service Worker standards. La logique de planification intelligente est isolée dans `src/planner.js`, séparée de la source GTFS et testable indépendamment.

Une couche Android native minimale pourra être ajoutée après la v1.0 pour fournir un vrai widget d’écran d’accueil sans réécrire le cœur PWA.

## Développement

```bash
npm run test:syntax
npm run test:planner
npm run test:gtfs
npm run build
```

Le build produit le dossier `dist/` sans dépendance tierce.

## Gouvernance

Le dépôt suit une règle stricte : **une issue, une branche, une pull request**. Voir `AGENTS.md`.
