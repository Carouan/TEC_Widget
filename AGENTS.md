# AGENTS.md

## Mission
TEC Widget est une PWA légère destinée à afficher rapidement les prochains passages planifiés du TEC pour des trajets favoris.

## Principe de travail
Le dépôt évolue de manière incrémentale et contrôlée, issue par issue.

## Règles absolues
1. Ne jamais travailler directement sur `main`.
2. Une unité d’implémentation = une issue GitHub.
3. Une branche = une issue.
4. Une PR = une issue.
5. Ne pas mélanger refactor structurel et fonctionnalité métier si les deux peuvent être séparés.
6. Préférer des commits petits et explicites.
7. Ne pas introduire de dépendance lourde sans justification.
8. Préserver le fonctionnement PWA existant.
9. Ne pas casser les préférences/configurations locales existantes sans migration explicite.
10. La validation pertinente doit réussir avant ouverture de la PR.

## Politique de branche
Format recommandé : `feature/issue-<numéro>-<description-courte>`.

## Politique de PR
Chaque PR doit documenter :
- objectif ;
- changements réalisés ;
- fichiers impactés ;
- risques ;
- validation ;
- rollback ;
- `Closes #<numéro>` si l’issue est entièrement résolue.

## Périmètre produit v1.0
- PWA installable Android/Windows ;
- deux trajets favoris configurables ;
- bascule automatique selon l’heure ;
- trois prochains passages planifiés ;
- GTFS TEC et cache local ;
- inversion manuelle aller/retour ;
- fonctionnement offline avec les dernières données disponibles.

## Hors périmètre v1.0
- widget Android natif ;
- widget Windows natif ;
- backend ou compte utilisateur ;
- synchronisation multi-appareils.

## Architecture
- privilégier HTML/CSS/JavaScript standard tant que cela reste maintenable ;
- isoler la logique métier de l’interface ;
- isoler la source GTFS afin qu’une future source temps réel puisse être ajoutée sans réécrire l’UI ;
- privilégier local-first et les données ouvertes.

## Validation minimale
Pour toute modification applicative :
- `npm run build` ;
- vérification ciblée des fichiers touchés ;
- aucun échec évident dans la zone modifiée.

## Définition de terminé
Une issue est terminée seulement lorsque :
- son périmètre exact est implémenté ;
- la validation pertinente est réussie ;
- les changements sont sur une branche dédiée ;
- une PR petite et lisible est ouverte ;
- la PR décrit validation et rollback.
