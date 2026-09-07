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

## Données GTFS

Le feed officiel TEC est trop volumineux pour être téléchargé directement par la PWA. Le projet le prétraite donc avant déploiement pour produire `public/data/schedules.json`, qui ne contient que les passages utiles aux trajets configurés.

Source producteur : `https://opendata.tec-wl.be/Current%20GTFS/TEC-GTFS.zip`.

Pour préparer les données réelles :

```bash
npm run prepare:gtfs
npm run build
```

Le script Python utilise uniquement la bibliothèque standard et traite `stop_times.txt` en streaming afin de ne pas charger plusieurs millions de lignes en mémoire.

Sans `schedules.json`, l’application conserve volontairement les horaires de démonstration et l’indique explicitement dans l’interface.

Un workflow GitHub Actions manuel **Prepare TEC GTFS** permet aussi de télécharger le feed officiel, générer le JSON compact et produire un artefact `dist/` complet.

## Architecture

L’application reste volontairement sans framework ni dépendance applicative : HTML, CSS, JavaScript et Service Worker standards. La logique métier est séparée de la source GTFS afin de pouvoir ajouter ensuite une source temps réel sans réécrire l’interface.

Une couche Android native minimale pourra être ajoutée après la v1.0 pour fournir un vrai widget d’écran d’accueil sans réécrire le cœur PWA.

## Développement

```bash
npm run test:gtfs
npm run build
```

Le build produit le dossier `dist/` sans dépendance tierce.

## Gouvernance

Le dépôt suit une règle stricte : **une issue, une branche, une pull request**. Voir `AGENTS.md`.
