-- ============================================================
-- 00078 — Carte allégée : Cotonou et Côte d'Ivoire
-- Demande produit : ne garder que les 30 artistes les plus suivis à Cotonou
-- et les 30 plus suivis en Côte d'Ivoire. 97 fiches retirées (aucune
-- revendiquée). Sauvegarde : musimaps-play/sauvegardes/artistes-retires-2026-10-21.json
-- ============================================================
DELETE FROM public.map_artists
WHERE claimed_by IS NULL
  AND id IN (
    'bj-faty', -- Faty
    'bj-tyaf', -- Tyaf
    'bj-patrick-ruffino', -- Patrick Ruffino
    'bj-oluwa-kemy', -- Oluwa Kêmy
    'bj-d-blue', -- D-Blue
    'bj-serge-ananou', -- Serge Ananou
    'bj-chaarlity', -- Chaarlity
    'bj-ferry-djimmy', -- Ferry Djimmy
    'bj-dossi', -- Dossi
    'bj-ardiess', -- Ardiess
    'bj-afafa', -- Afafa
    'bj-black-santiago', -- Black Santiago
    'bj-yewhe-yeton', -- Yéwhé Yéton
    'bj-pelagie-la-vibreuse', -- Pélagie la Vibreuse
    'bj-didi-soddy', -- Didi Soddy
    'bj-naldo', -- Naldo
    'bj-shamir-mg', -- Shamir MG
    'bj-sahel-la-cip', -- Sahel La Cip
    'bj-bmg-yari', -- BMG Yari
    'bj-kenu-xheviosso', -- Kènu Xhèviosso
    'bj-seminvo-xlixe', -- Sêminvo Xlixè
    'bj-kaysee-edge-montejano', -- Kaysee Edge Montejano
    'bj-koudy-fagbemi', -- Koudy Fagbemi
    'bj-pepit-arts', -- Pépit'Arts
    'bj-jean-adagbenon', -- Jean Adagbénon
    'bj-fat-b', -- Fat-B
    'bj-sol-joyce', -- Sol Joyce
    'bj-black-dash', -- Black Dash
    'ci-tam-sir', -- Tam Sir
    'ci-morijah', -- Morijah
    'ci-ismael-isaac', -- Ismaël Isaac
    'ci-les-leaders', -- Les Leaders
    'ci-les-garagistes', -- Les Garagistes
    'ci-espoir-2000', -- Espoir 2000
    'ci-dobet-gnahore', -- Dobet Gnahoré
    'ci-safarel-obiang', -- Safarel Obiang
    'ci-roseline-layo', -- Roseline Layo
    'ci-team-paiya', -- Team Paiya
    'ci-mosty', -- Mosty
    'ci-ste-milano', -- Ste Milano
    'ci-petit-denis', -- Petit Denis
    'ci-tour-2-garde', -- Tour 2 Garde
    'ci-kedjevara', -- Kedjevara
    'ci-kadja', -- Kadja
    'ci-dezy-champion', -- Dezy Champion
    'ci-douk-saga', -- Douk Saga
    'ci-zouglou-makers', -- Zouglou Makers
    'ci-nash', -- Nash
    'ci-lesky', -- Lesky
    'ci-moliere', -- Molière
    'ci-monique-seka', -- Monique Séka
    'ci-yabongo-lova', -- Yabongo Lova
    'ci-kerozen', -- Kerozen
    'ci-les-salopards', -- Les Salopards
    'ci-constance-aman', -- Constance Aman
    'ci-fitini', -- Fitini
    'ci-o-nel-mala', -- O'Nel Mala
    'ci-joochar', -- Joochar
    'ci-dj-caloudji', -- DJ Caloudji
    'ci-billy-billy', -- Billy Billy
    'ci-garba-50', -- Garba 50
    'ci-mathey', -- Mathey
    'ci-aicha-kone', -- Aïcha Koné
    'ci-dj-jacob', -- DJ Jacob
    'ci-tazeboy', -- Tazeboy
    'ci-les-poussins-chocs', -- Les Poussins Chocs
    'ci-manou-gallo', -- Manou Gallo
    'ci-ernesto-djedje', -- Ernesto Djédjé
    'ci-renard-barakissa', -- Renard Barakissa
    'ci-lino-versace', -- Lino Versace
    'ci-didier-bile', -- Didier Bilé
    'ci-jc-pluriel', -- JC Pluriel
    'ci-affou-keita', -- Affou Kéïta
    'ci-bailly-spinto', -- Bailly Spinto
    'ci-boro-sanguy', -- Boro Sanguy
    'ci-luckson-padaud', -- Luckson Padaud
    'ci-serges-kassy', -- Serges Kassy
    'ci-chantal-taiba', -- Chantal Taïba
    'ci-les-mercenaires', -- Les Mercenaires
    'ci-paco-sery', -- Paco Séry
    'ci-nayanka-bell', -- Nayanka Bell
    'ci-rocky-gold', -- Rocky Gold
    'ci-les-marabouts-d-afrique', -- Les Marabouts d'Afrique
    'ci-eljay', -- Eljay
    'ci-samy-succes', -- Samy Succès
    'ci-psk', -- PSK
    'ci-antoinette-konan', -- Antoinette Konan
    'ci-joelle-seka', -- Joëlle Séka
    'ci-reine-pelagie', -- Reine Pélagie
    'ci-atito-kpata', -- Atito Kpata
    'ci-claire-bahi', -- Claire Bahi
    'ci-francois-lougah', -- François Lougah
    'ci-vitale', -- Vitale
    'ci-les-potes-de-la-rue', -- Les Potes de la Rue
    'ci-esprit-de-yop', -- Esprit de Yop
    'ci-erickson-le-zulu', -- Erickson Le Zulu
    'ci-systeme-gazeur' -- Système Gazeur
  );
