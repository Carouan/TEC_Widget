# Releases Android signées

Ce document décrit la procédure officielle pour produire des APK Android stables et installables par-dessus les versions précédentes.

## Principe

L'identité Android de l'application repose sur deux éléments qui doivent rester stables :

- `applicationId` : `be.carouan.tecwidget` ;
- certificat de signature : une seule clé privée de release, créée une fois et conservée durablement.

Les APK debug GitHub Actions restent destinés aux tests. Les APK distribués aux utilisateurs doivent provenir du workflow **Android Release** et être signés avec la clé release.

## 1. Créer la clé release une seule fois

Sur Windows, avec un JDK installé :

```powershell
keytool -genkeypair -v `
  -keystore tec-widget-release.jks `
  -storetype JKS `
  -alias tec-widget `
  -keyalg RSA `
  -keysize 4096 `
  -validity 10000
```

Choisir un mot de passe robuste et conserver :

- `tec-widget-release.jks` ;
- le mot de passe du keystore ;
- l'alias (`tec-widget` si la commande ci-dessus est utilisée) ;
- le mot de passe de la clé.

**Ne jamais committer le keystore ni les mots de passe.** Faire au minimum deux sauvegardes hors du dépôt. La perte de cette clé empêcherait les futures APK de mettre à jour une version release déjà installée.

## 2. Relever l'empreinte SHA-256 publique

```powershell
keytool -list -v -keystore .\tec-widget-release.jks -alias tec-widget | Select-String "SHA256"
```

Conserver l'empreinte au format `AA:BB:CC:...`. Elle n'est pas secrète : elle sert à vérifier la signature et à établir Digital Asset Links avec la PWA.

## 3. Encoder le keystore pour GitHub Actions

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("tec-widget-release.jks")) | Set-Clipboard
```

Créer ensuite dans **Settings → Secrets and variables → Actions → Secrets** :

| Secret | Valeur |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | contenu Base64 du fichier `.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | alias de la clé, par ex. `tec-widget` |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé |

Puis dans **Variables** créer :

| Variable | Valeur |
| --- | --- |
| `ANDROID_CERT_SHA256` | empreinte SHA-256 du certificat |

L'empreinte est volontairement une variable et non un secret : elle est publique par nature.

## 4. Versionner une release

La version officielle se trouve dans `android/version.properties` :

```properties
VERSION_NAME=0.1.0
VERSION_CODE=1
```

Pour chaque release :

1. incrémenter `VERSION_NAME` selon SemVer ;
2. incrémenter obligatoirement `VERSION_CODE` ;
3. merger la modification sur `main` ;
4. créer puis pousser le tag exact `android-v<VERSION_NAME>`.

Exemple :

```powershell
git tag android-v0.2.0
git push origin android-v0.2.0
```

Le workflow refuse une release si le tag et `VERSION_NAME` ne correspondent pas.

## 5. Ce que fait automatiquement Android Release

Le workflow `.github/workflows/android-release.yml` :

1. restaure le keystore depuis les secrets ;
2. compile `assembleRelease` ;
3. signe l'APK avec la clé stable ;
4. vérifie la signature avec `apksigner` ;
5. compare l'empreinte réelle avec `ANDROID_CERT_SHA256` ;
6. produit un checksum SHA-256 ;
7. crée une GitHub Release avec :
   - `TEC-Widget-X.Y.Z.apk` ;
   - `TEC-Widget-X.Y.Z.apk.sha256`.

Le pipeline s'arrête si l'identité du certificat n'est pas celle attendue.

## 6. Trusted Web Activity / Digital Asset Links

Lors du déploiement GitHub Pages, si `ANDROID_CERT_SHA256` est définie, le build génère automatiquement :

```text
/.well-known/assetlinks.json
```

Ce fichier associe `https://carouan.github.io/TEC_Widget/` au package Android `be.carouan.tecwidget` et à son certificat release. Cela permet à Android Browser Helper de vérifier la relation entre l'APK et la PWA et d'utiliser une TWA vérifiée plutôt qu'un simple Custom Tab.

## 7. Vérification d'une APK téléchargée

Le checksum publié peut être contrôlé sous PowerShell :

```powershell
Get-FileHash .\TEC-Widget-0.2.0.apk -Algorithm SHA256
```

Pour vérifier le certificat avec les Android Build Tools :

```powershell
apksigner verify --verbose --print-certs .\TEC-Widget-0.2.0.apk
```

L'empreinte affichée doit correspondre à `ANDROID_CERT_SHA256`.

## Règles à conserver

- ne jamais remplacer la clé release pour une simple nouvelle version ;
- ne jamais réutiliser un `VERSION_CODE` déjà distribué ;
- ne jamais publier un APK debug comme release officielle ;
- conserver le keystore en dehors de GitHub, avec sauvegardes ;
- publier les versions officielles uniquement via un tag `android-vX.Y.Z`.
