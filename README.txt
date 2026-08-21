PATRIMOINE SIMULATOR — PATCH PC V2.4.15
CASH-FLOW LOCATIF RÉELLEMENT NET

SUR main :

REMPLACER :
- pc-visual-v230.js

AJOUTER :
- rental-net-v2415.js

CONSERVER tous les autres fichiers V2.4.

CORRECTION :

Avant :
« Revenus locatifs nets » =
loyer - charges - mensualité du crédit

Mais l'impôt supplémentaire lié aux loyers était payé séparément par le jeu.
L'indicateur était donc plus favorable que le cash-flow réellement disponible.

Maintenant :
Cash-flow locatif net =
loyer
- charges locatives
- mensualité du crédit locatif
- supplément d'impôt généré par le revenu locatif

Le supplément d'impôt est calculé avec le même barème simplifié que le moteur,
par différence entre :
- impôt salaire + revenu locatif taxable
- impôt salaire seul

IMPORTANT :
Ce patch ne prélève aucun impôt supplémentaire.
monthlyTax() continue de gérer le vrai prélèvement mensuel.
Le correctif ne change que l'indicateur et les objectifs afin d'éviter
un double prélèvement.

L'objectif « revenus locatifs » devient donc réellement net après fiscalité.
