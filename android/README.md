# TEC Widget Android

Couche Android autour de la PWA existante.

## Contenu

- `MainActivity` ouvre `https://carouan.github.io/TEC_Widget/` via Android Browser Helper / Trusted Web Activity ;
- `TecWidgetProvider` fournit un vrai widget Android d’écran d’accueil ;
- le widget lit `https://carouan.github.io/TEC_Widget/data/schedules.json` ;
- il affiche les prochains passages planifiés et permet un rafraîchissement manuel ;
- toucher le widget ouvre la PWA.

## Builds debug

Le workflow `Android APK` produit un APK debug pour les tests de PR et les essais rapides sur appareil réel.

```bash
cd android
gradle assembleDebug
```

APK : `app/build/outputs/apk/debug/app-debug.apk`.

Les APK debug ne constituent **pas** le canal de distribution officiel : leur signature n'est pas garantie stable entre environnements.

## Releases officielles

Les APK distribuées durablement utilisent une clé release stable conservée hors du dépôt. Le workflow `Android Release`, déclenché par un tag `android-vX.Y.Z`, restaure cette clé depuis les secrets GitHub, compile et vérifie l'APK signé, génère un checksum SHA-256 et publie les deux fichiers dans une GitHub Release.

La configuration et la procédure complète sont décrites dans [`RELEASES.md`](RELEASES.md).

La version Android est centralisée dans [`version.properties`](version.properties). `VERSION_CODE` doit être incrémenté à chaque release distribuée.

## TWA vérifiée

Quand la variable GitHub `ANDROID_CERT_SHA256` est configurée, le déploiement de la PWA publie automatiquement `/.well-known/assetlinks.json`. Android peut alors vérifier que le site et le package `be.carouan.tecwidget` appartiennent au même projet et ouvrir la PWA comme Trusted Web Activity vérifiée.

## Limites actuelles

- les favoris Android ne sont pas encore synchronisés avec le `localStorage` de la PWA ;
- pas encore de publication Play Store ;
- l'installation/mise à jour directe depuis la PWA sera traitée après stabilisation du premier canal release signé.
