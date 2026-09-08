# TEC Widget Android

Première couche Android autour de la PWA existante.

## Contenu

- `MainActivity` ouvre `https://carouan.github.io/TEC_Widget/` via Android Browser Helper / Trusted Web Activity ;
- `TecWidgetProvider` fournit un vrai widget Android d’écran d’accueil ;
- le widget lit `https://carouan.github.io/TEC_Widget/data/schedules.json` ;
- il affiche trois prochains passages planifiés et permet un rafraîchissement manuel ;
- toucher le widget ouvre la PWA.

## Limites v0.1

- les favoris Android ne sont pas encore synchronisés avec le `localStorage` de la PWA ;
- le choix automatique est volontairement simple : matin → aller, après-midi → retour, soirée → prochain matin ;
- l’APK produit par CI est un build `debug` non destiné au Play Store ;
- sans Digital Asset Links/signature release, Android Browser Helper peut retomber en Custom Tab au lieu d’une TWA pleinement vérifiée.

## Build local

Le workflow GitHub utilise Gradle 8.10.2 et Java 17 :

```bash
cd android
gradle assembleDebug
```

APK : `app/build/outputs/apk/debug/app-debug.apk`.
