PATRIMOINE SIMULATOR — V1.9 MARCHÉS RÉALISTES + FRAIS
Branche de test : mobile-ui

À ajouter sur mobile-ui :
- market-engine.js   (nouveau)
- market-ui.css      (nouveau)
- sw.js              (remplace l'ancien)

À CONSERVER :
- index.html
- tax-engine.js
- tax-ui.css
- mobile.css
- mobile-v2.css
- mobile-v21.css
- mobile-nav-v21.js

Le moteur V1.9 :
- remplace les rendements mensuels uniformes par un modèle probabiliste calibré ;
- ajoute des cycles normal / haussier / baissier / crise ;
- applique les frais réellement au patrimoine ;
- affiche les frais par produit, par année et cumulés ;
- intègre les frais de cession CTO/crypto dans la plus-value fiscale simulée ;
- conserve la fiscalité V1.8 existante.

Ne pas installer sur main avant validation du Preview mobile-ui.
