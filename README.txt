PATRIMOINE SIMULATOR — PATCH PC V2.4.16
NOTE FINANCIÈRE ANNUELLE COHÉRENTE

SUR main :

REMPLACER :
- pc-visual-v230.js

AJOUTER :
- annual-grade-v2416.js

CONSERVER tous les autres fichiers V2.4.

PROBLÈME CORRIGÉ :
La note annuelle historique utilisait :
investissements annuels / revenus

Or « investissements annuels » mesure les montants placés, pas l'enrichissement.
Il était possible de retirer un capital puis de le replacer plus tard et de
faire monter artificiellement la note.

NOUVELLE NOTE :
- évolution du patrimoine corrigée de l'inflation ;
- excédent ou déficit entre revenus et dépenses ;
- poids des intérêts bancaires dans les revenus ;
- épargne de sécurité = trésorerie + Livret ;
- bonheur.

Le volume brut de placements reste affiché dans le bilan mais ne donne plus
directement de points.

Le joueur peut donc investir beaucoup, peu ou différemment :
c'est le résultat global et la solidité de sa situation qui sont évalués.

Aucun patrimoine, investissement, rendement, impôt, crédit ou trésorerie
n'est modifié par ce patch.
