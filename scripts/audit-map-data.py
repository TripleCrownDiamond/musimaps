"""Audit de la qualité des données map_artists.

Usage:
  cd apps/web && set -a && source .env.local && set +a
  python ../../scripts/audit-map-data.py

Vérifie : doublons par nom, city vide / pays-comme-ville, pays incomplet,
genres bruyants, coordonnées invalides (0,0), localisation incohérente.
"""
import json
import os
import urllib.request
from collections import Counter

SUPA_URL = os.environ["VITE_SUPABASE_URL"].rstrip("/")
ANON = os.environ["VITE_SUPABASE_ANON_KEY"]


def fetch(path):
    req = urllib.request.Request(
        f"{SUPA_URL}{path}",
        headers={"apikey": ANON, "Authorization": f"Bearer {ANON}"},
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def norm(v):
    return (v or "").lower().strip()


rows = fetch("/rest/v1/map_artists?select=id,name,city,country,lat,lng,genre,verified,claimed_by&order=name")
print(f"=== TOTAL: {len(rows)} artistes ===")

# 1) Doublons par nom
names = Counter(norm(r["name"]) for r in rows)
print("\n=== 1) DOUBLONS PAR NOM ===")
dups = {n: c for n, c in names.items() if c > 1}
if not dups:
    print("  aucun")
for n, c in dups.items():
    for r in rows:
        if norm(r["name"]) == n:
            print(f"  {r['name']!r} | city={r.get('city')!r} country={r.get('country')!r} lat={r.get('lat')} lng={r.get('lng')} id={r['id']}")

# 2) Coordonnées invalides ou manquantes
print("\n=== 2) COORDONNÉES INVALIDES (0/None, hors range) ===")
bad = 0
for r in rows:
    lat, lng = r.get("lat"), r.get("lng")
    if lat is None or lng is None or (lat == 0 and lng == 0) or not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        bad += 1
        print(f"  {r['name']!r} lat={lat} lng={lng} city={r.get('city')!r}")
print(f"  {bad} invalide(s)")

# 3) city vide ou city == nom de pays (artiste non localisable → pin parasite)
print("\n=== 3) CITY VIDE / PAYS-COMME-VILLE ===")
import unicodedata
def strip_accents(v):
    return "".join(c for c in unicodedata.normalize("NFD", v) if not unicodedata.combining(c)).lower()
# Noms de PAYS uniquement (jamais de villes réelles : Porto Alegre, Lagos…).
# On repère l'artefact « pays-comme-ville » : city vaut un nom de pays.
countries = {
    "benin", "nigeria", "france", "ghana", "senegal", "togo", "cote d ivoire",
    "cote d'ivoire", "ivoire", "cameroun", "guinee", "guinee bissau", "mali",
    "burkina faso", "democratic republic of the congo", "republique democratique du congo",
    "rdc", "congo", "bresil", "brazil", "etats unis", "united states", "usa",
    "royaume uni", "united kingdom", "angleterre", "canada", "belgique", "suisse",
    "allemagne", "germany", "russie", "russia", "cap vert", "cabo verde", "kenya",
}
for r in rows:
    city = norm(r.get("city"))
    if not city:
        print(f"  {r['name']!r} | CITY VIDE | country={r.get('country')!r} lat={r.get('lat')} lng={r.get('lng')} id={r['id']}")
    elif strip_accents(city) in countries:
        print(f"  {r['name']!r} | CITY=PAYS: {r.get('city')!r} | country={r.get('country')!r} id={r['id']}")

# 4) Genres bruyants (non-musicaux)
print("\n=== 4) GENRES BRUYANTS ===")
noisy = {"unknown", "artiste", "band", "drummer", "hot", "international", "african",
         "beninese", "algerian-canadian", "zoblazo", "drake", "rosalia"}
for r in rows:
    g = strip_accents(norm(r.get("genre")))
    if g in noisy:
        print(f"  {r['name']!r} | genre={r.get('genre')!r}")

# 5) Récapitulatif pays
print("\n=== 5) RÉPARTITION PAR PAYS ===")
pc = Counter((r.get("country") or "?").upper() for r in rows)
for k, v in sorted(pc.items(), key=lambda x: -x[1]):
    print(f"  {k}: {v}")
