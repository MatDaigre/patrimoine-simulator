PATRIMOINE SIMULATOR — PATCH PC V2.4.10
COHÉRENCE OBJECTIFS HISTORIQUES + AUDIT INFLATION

SUR main :

REMPLACER :
- pc-visual-v230.js

AJOUTER :
- coherence-v2410.js

AUCUNE LIGNE À SAISIR.
NE PAS MODIFIER index.html.
CONSERVER les fichiers V2.4.9 déjà présents.

CORRECTIONS OBJECTIFS :
- ancien objectif 1 mois / 3 mois = trésorerie positive + Livret ;
- PEA / CTO / crypto / assurance-vie exclus de l'épargne de sécurité ;
- ancien jalon « premier capital » = placements long terme hors Livret ;
- score de santé historique utilise la même définition de la sécurité ;
- ancienne jauge 3 mois est harmonisée avec le nouveau guide.

VERSEMENTS AUTOMATIQUES :
- vérification : le moteur stocke bien les montants dans state.autoInvest ;
- les versements exécutés modifient réellement Livret / PEA / AV / CTO / crypto ;
- le guide V2.4.9 lit donc la bonne structure.

INFLATION — CE QUI ÉTAIT DÉJÀ CORRECT :
- mensualisation composée du taux annuel ;
- priceIndex ;
- logement, vie courante, transport, loisirs et charges locatives ;
- gros imprévus et événements V2.4.

INFLATION — CORRECTIONS V2.4.10 :
- bilan annuel en rendement réel avec formule exacte :
  (1 + rendement nominal) / (1 + inflation) - 1 ;
- si patrimoine initial <= 0, aucun pourcentage trompeur n'est affiché ;
- pouvoir d'achat de la trésorerie affiché en euros constants au lieu
  de prétendre que tout le cash actuel était détenu depuis le début ;
- suivi prospectif de l'érosion des liquidités nominales ;
- prix futurs des voitures indexés sur le niveau général des prix ;
- prix futurs des biens immobiliers indexés ;
- apport locatif fixe indexé ;
- loyer proposé au moment d'un achat locatif indexé ;
- coût des formations indexé.

NOTE SAUVEGARDES EXISTANTES :
Pour une partie déjà commencée, l'ancien total « inflation estimée » est repris
comme historique approximatif, puis le calcul V2.4.10 devient plus précis
pour les mois suivants.

Aucun rendement de marché, taux de crédit ni règle fiscale n'est modifié.
