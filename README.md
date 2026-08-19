# Patrimoine Simulator — Patch commun V2.1.3

Patch du moteur commun PC + mobile, prévu pour l’architecture modulaire V2.x.

## Ordre de chargement
Charger après `tax-engine.js`, `market-engine.js` et `personal-situation.js` :

```html
<link rel="stylesheet" href="./common-fixes-v213.css?v=213">
<script defer src="./common-fixes-v213.js?v=213"></script>
```

## Correctifs
- bonheur < 50 = défaite ; suppression du plancher artificiel à 50 ;
- avertissement avant simulation multi-mois ;
- variation du patrimoine enrichie mois par mois ;
- notification et désactivation au niveau de formation maximal ;
- gros imprévus 500–1 000 € à cadence contrôlée ;
- très gros imprévu 5 000–10 000 € environ tous les 5 ans ;
- bonheur visible dans le budget ;
- retrait des espèces PEA et clôture avant 5 ans après vente des supports ;
- nettoyage des bases résiduelles après liquidation totale ;
- plusieurs prêts personnels simultanés ;
- amortissement et intérêts cumulés des prêts personnels ;
- encart pédagogique sur le crédit personnel ;
- bilan cumulatif frais / impôts / inflation / intérêts ;
- mention « impact sur la trésorerie » si le reste est négatif ;
- API de diagnostic : `window.PatrimoineCommonFixes`.

## Contrôle PEA
Le patch ne contourne pas le moteur fiscal lors de la vente. Il ajoute le maillon qui manquait après la vente :
les espèces présentes dans `state.tax.peaCash` peuvent être sorties de l’enveloppe ; avant 5 ans, cette sortie clôture le PEA dans le jeu.

## Intégration
Le connecteur GitHub était indisponible pendant la génération. Le package est donc prêt à intégrer, mais n’a pas encore été poussé dans le dépôt Vercel.
