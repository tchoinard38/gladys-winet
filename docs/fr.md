# Thermorossi WiNET — intégration Gladys Assistant (non officielle)

Cette intégration amène dans Gladys Assistant les poêles à granulés équipés
du module Wi-Fi **WiNET** (Thermorossi, et les autres marques qui utilisent
le portail thermorossi.cloudwinet.it / cloudwinet.it).

## Ce qu'elle fait

Un appareil par poêle, avec les fonctions que le poêle possède :

| Fonction | Dans Gladys |
| --- | --- |
| Marche/arrêt | mode du thermostat : arrêt / chauffe |
| Consigne air | température de consigne du thermostat (5 à 40 °C) |
| Chauffe | état de fonctionnement : le poêle produit de la chaleur (allumage, travail) ou non |
| Température ambiante | capteur de température (°C) |
| État | texte : veille, attente de flamme, allumage, en chauffe, nettoyage, alarme… |
| Alarme | capteur binaire : 1 tant que le poêle est en alarme |
| Puissance | choix du niveau de puissance (1 à 5) |

Une scène peut aussi se déclencher sur **l'alarme du poêle** (gâchette
`stove_alarm`, une fois par alarme).

## Prérequis

- Un poêle WiNET qui fonctionne dans l'application Thermorossi Connector (ou
  le portail https://thermorossi.cloudwinet.it) sur votre téléphone.
- Un compte Gladys Assistant en version 5.1 ou plus.

## Configuration

1. Ouvrez **Intégrations** dans Gladys, installez cette intégration.
2. Dans l'onglet **Configuration**, saisissez l'e-mail et le mot de passe du
   portail WiNET, puis cliquez sur **Tester la connexion** : l'état du poêle
   s'affiche.
3. Ouvrez l'onglet **Découverte** et créez le poêle.

L'intégration se connecte au cloud WiNET par Internet, jamais directement au
poêle : le poêle doit être en ligne dans l'application. L'e-mail et le mot de
passe restent dans la configuration de Gladys (champ secret) ; la clé d'API
de l'appareil, récupérée du portail comme le fait l'application, est gardée
dans le volume de données de l'intégration et ressaisie automatiquement si le
cloud la refuse.

## Dépannage

- « Connexion au portail WiNET impossible » : vérifiez les identifiants ; un
  nouvel essai est retenté automatiquement toutes les 15 minutes.
- Le cloud renvoie des températures à 0 quand le poêle est à l'arrêt :
  l'intégration ne publie alors que l'état et le mode, pas de fausses
  températures.
- Une seule session active à la fois côté WiNET : si l'application officielle
  est ouverte en parallèle, des conflits de commande sont possibles.

Intégration communautaire non officielle, sans lien avec Thermorossi ni
NetSoftware.
