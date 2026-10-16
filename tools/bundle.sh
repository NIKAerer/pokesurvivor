#!/bin/sh
# Assemble le jeu en un seul fichier HTML autonome : dist/pokesurvivor.html
set -e
cd "$(dirname "$0")/.."
mkdir -p dist
awk '
  /<script src="data.js"><\/script>/ { print "<script>"; while ((getline l < "data.js") > 0) print l; print "</script>"; next }
  /<script src="game.js"><\/script>/ { print "<script>"; while ((getline l < "game.js") > 0) print l; print "</script>"; next }
  { print }' index.html > dist/pokesurvivor.html
echo "dist/pokesurvivor.html"
