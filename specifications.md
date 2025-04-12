# Spécifications Techniques de l'API de Synchronisation

Ce document décrit l'API REST simple que le backend Express.js doit implémenter pour permettre la synchronisation des données depuis l'application mobile Expo "Naissances veaux".

L'application fonctionne hors ligne et tente d'envoyer l'intégralité de ses données locales à l'API après chaque modification réussie.

## Endpoint

- **Méthode:** `PUT`
- **Route:** `/sync`

## Format des Données

### Corps de la Requête (Request Body)

L'application enverra un tableau JSON contenant l'ensemble des campagnes stockées localement. La structure de chaque objet campagne doit correspondre aux types définis dans l'application (`src/types.ts`).

```json
[
  {
    "id": "string (UUID)",
    "name": "string",
    "createdAt": "string (ISO 8601 Date)",
    "calves": [
      {
        "id": "string (UUID)",
        "motherId": "string",
        "sexColor": "string ('FB' | 'MB' | 'FJ' | 'MJ')",
        "calfId": "string",
        "notes": "string | null",
        "isDeclared": "boolean",
        "declarationBatchId": "string (UUID) | null"
      }
      // ... autres veaux
    ],
    "declarationBatches": [
      {
        "id": "string (UUID)",
        "declaredAt": "string (ISO 8601 Date)"
      }
      // ... autres lots de déclaration
    ]
  }
  // ... autres campagnes
]
```

**Important:** L'API doit remplacer *complètement* les données existantes en base de données par le nouveau tableau reçu à chaque appel `PUT /sync`.

### Réponse (Response)

- **Succès:**
    - Code Statut: `200 OK`
    - Corps: Optionnel (peut être vide ou un message simple comme `{"message": "Sync successful"}`)
- **Erreur Client (Format invalide):**
    - Code Statut: `400 Bad Request`
    - Corps: Optionnel (peut contenir un message d'erreur décrivant le problème)
- **Erreur Serveur:**
    - Code Statut: `500 Internal Server Error`
    - Corps: Optionnel

## Schéma de la Base de Données SQLite

Pour une implémentation simple et robuste, il est recommandé de normaliser les données dans trois tables relationnelles. L'API devra gérer la logique de suppression/insertion/mise à jour pour refléter l'état envoyé par l'application.

**Table: `Campaigns`**

| Colonne     | Type   | Contraintes   | Description                 |
| ----------- | ------ | ------------- | --------------------------- |
| `id`        | `TEXT` | `PRIMARY KEY` | UUID de la campagne         |
| `name`      | `TEXT` | `NOT NULL`    | Nom de la campagne          |
| `createdAt` | `TEXT` | `NOT NULL`    | Date de création (ISO 8601) |

**Table: `Calves`**

| Colonne              | Type      | Contraintes   | Description                     |
| -------------------- | --------- | ------------- | ------------------------------- |
| `id`                 | `TEXT`    | `PRIMARY KEY` | UUID du veau                    |
| `campaignId`         | `TEXT`    | `NOT NULL`    | FK vers `Campaigns.id`          |
| `motherId`           | `TEXT`    | `NOT NULL`    | ID de la mère                   |
| `sexColor`           | `TEXT`    | `NOT NULL`    | Sexe/Couleur ('FB', 'MB', etc.) |
| `calfId`             | `TEXT`    | `NOT NULL`    | ID du veau                      |
| `notes`              | `TEXT`    |               | Notes optionnelles              |
| `isDeclared`         | `INTEGER` | `NOT NULL`    | 0 (False) ou 1 (True)           |
| `declarationBatchId` | `TEXT`    |               | FK vers `DeclarationBatches.id` |

**Table: `DeclarationBatches`**

| Colonne      | Type   | Contraintes   | Description                    |
| ------------ | ------ | ------------- | ------------------------------ |
| `id`         | `TEXT` | `PRIMARY KEY` | UUID du lot de déclaration     |
| `campaignId` | `TEXT` | `NOT NULL`    | FK vers `Campaigns.id`         |
| `declaredAt` | `TEXT` | `NOT NULL`    | Date de déclaration (ISO 8601) |


**Logique de synchronisation côté serveur:**

1.  Recevoir le tableau JSON via `PUT /sync`.
2.  Démarrer une transaction SQLite.
3.  Supprimer *toutes* les données existantes dans les tables `Calves`, `DeclarationBatches`, et `Campaigns` (dans cet ordre pour respecter les contraintes de clé étrangère, si elles sont définies).
4.  Itérer sur le tableau JSON reçu:
    *   Pour chaque campagne, insérer une ligne dans `Campaigns`.
    *   Pour chaque veau dans la campagne, insérer une ligne dans `Calves`, en liant avec `campaignId`.
    *   Pour chaque lot de déclaration dans la campagne, insérer une ligne dans `DeclarationBatches`, en liant avec `campaignId`.
5.  Valider la transaction SQLite.
6.  Renvoyer une réponse `200 OK`. En cas d'erreur durant le processus, annuler la transaction et renvoyer une réponse d'erreur appropriée (`400` ou `500`). 