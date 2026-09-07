# TEC Widget

PWA légère pour afficher rapidement les prochains passages planifiés du réseau TEC sur des trajets favoris.

## Objectif v1.0

- PWA installable sur Android et Windows ;
- deux trajets favoris configurables : arrêt, ligne et direction ;
- sélection automatique du trajet pertinent selon l’heure ;
- affichage des trois prochains passages planifiés ;
- données GTFS TEC avec cache local ;
- inversion manuelle du trajet affiché ;
- fonctionnement hors ligne avec les dernières données disponibles.

## Cas d’usage initial

- matin : ligne 9, arrêt `Belgrade - Rue Laide Coupe`, direction `Jambes` ;
- retour : ligne 9, arrêt `Rue des Combattants`, direction `Flawinne`.

Les horaires actuellement présents dans l’interface sont des données de démonstration. L’intégration du GTFS TEC réel sera traitée dans une issue dédiée.

## Architecture

La première fondation reste volontairement sans framework ni dépendance applicative : HTML, CSS, JavaScript et Service Worker standards. La logique métier est séparée de l’interface afin de pouvoir brancher ensuite le GTFS réel, puis éventuellement une source temps réel si le TEC en publie une.

Une couche Android native minimale pourra être ajoutée après la v1.0 pour fournir un vrai widget d’écran d’accueil sans réécrire le cœur PWA.

## Développement

```bash
npm run build
```

Le build produit le dossier `dist/` sans dépendance tierce.

## Gouvernance

Le dépôt suit une règle stricte : **une issue, une branche, une pull request**. Voir `AGENTS.md`.
