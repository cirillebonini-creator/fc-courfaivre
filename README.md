# FC Courfaivre — Infomaniak

Version Node.js autonome du site FCC. Les pages et le design sont repris de l’aperçu ChatGPT. Aucun WordPress, aucune dépendance npm externe. Node.js **24 LTS** requis.

## Installation Infomaniak

1. Importer ce dépôt privé sur `nouveau.fc-courfaivre.ch`, branche `main`.
2. Dossier d’exécution : racine du dépôt, là où se trouve `package.json`.
3. Commande de construction : `npm run build`.
4. Commande de lancement : `npm start`.
5. L’application utilise automatiquement le `PORT` fourni par Infomaniak. Ne pas coder un autre port en dur.
6. Activer HTTPS avant d’utiliser l’administration.

Définir les variables d’environnement dans la configuration du site :

| Variable | Valeur |
| --- | --- |
| `SITE_URL` | `https://nouveau.fc-courfaivre.ch` |
| `ADMIN_USER` | Identifiant choisi, par exemple `fcc` |
| `ADMIN_PASSWORD` | Mot de passe personnel unique, au moins 16 caractères |
| `DATA_DIR` | Chemin absolu d’un dossier persistant **hors du dépôt**, accessible à l’application |

Ne jamais ajouter le mot de passe dans Git, une URL Git ou une capture d’écran. Le fichier `.env.example` est un exemple ; le serveur ne charge pas de fichier `.env` automatiquement. Sans mot de passe configuré, le site reste visible et l’administration reste fermée.

Par défaut, les données sont placées dans `.local/share/fc-courfaivre` du dossier personnel du processus Node.js. Vérifier la persistance de ce dossier chez l’hébergeur ou définir explicitement `DATA_DIR` vers un emplacement persistant. Ne pas exposer ce dossier par un autre site Web.

## Administration

Ouvrir `/admin`. Le navigateur demande l’identifiant et le mot de passe. Les joueurs et portraits sont conservés dans une base SQLite `fcc.sqlite` située dans `DATA_DIR`. Les 82 joueurs exportés depuis l’aperçu au 18 novembre 2026 sont initialisés au premier démarrage seulement. Une mise à jour du code ne réinitialise pas cette base.

L’administration gère les joueurs et leurs photos. Les pages, actualités et autres contenus se modifient actuellement dans le code.

## Données ASF

Le serveur tente de récupérer les classements et les calendriers officiels. Si la source est indisponible ou si son format change, une copie datée du 18 novembre 2026 est utilisée, signalée dans l’interface. La compatibilité avec Infomaniak ne garantit pas la levée d’un blocage ASF ; vérifier les endpoints `/api/classement/premiere`, `/api/classement/deuxieme`, `/api/classement/veterans` et `/api/prochains-matchs/premiere` sur le site d’essai.

## Mises à jour par Git

1. Modifier et tester le code : `npm run build` puis `npm test`.
2. Envoyer le commit dans `main`.
3. Dans Infomaniak, récupérer la nouvelle révision du dépôt et relancer la construction, puis redémarrer l’application.

Une connexion Git ne constitue pas, à elle seule, un déploiement automatique à chaque push. Le déclenchement dépend de la configuration Infomaniak. Conserver `DATA_DIR` et les variables d’environnement lors de chaque mise à jour.

## Sauvegarde et migration

Avec les mêmes variables d’environnement que le serveur, exécuter `npm run backup`. Cette commande crée une sauvegarde SQLite cohérente dans `DATA_DIR`. Copier ensuite la sauvegarde dans un autre emplacement protégé. Pour restaurer, arrêter le site puis restaurer une sauvegarde avec les fichiers annexes SQLite gérés correctement ; conserver la base remplacée jusqu’à validation.

Pour passer au domaine principal, sauvegarder l’ancien site et sa base, tester les pages et l’administration sur le sous-domaine, puis modifier le domaine et `SITE_URL`. La bascule du site principal n’est pas effectuée par ce dépôt.

## Sources reprises

Les textes, portraits et photos du club proviennent de `https://fc-courfaivre.ch/`. Le comité est celui publié pour **2021–2022**. Le mot du président et les coordonnées de la buvette sont repris du site d’origine et doivent être validés par le club avant la mise en ligne définitive.

Le dépôt ne contient aucun mot de passe, jeton GitHub ou secret de l’aperçu ChatGPT. Les fichiers générés de `dist/server/` sont reconstruits par `npm run build`.
