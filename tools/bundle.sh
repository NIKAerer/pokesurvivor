#!/bin/sh
# Assemble le jeu en un seul fichier HTML autonome : dist/pokesurvivor.html
set -e
cd "$(dirname "$0")/.."
mkdir -p dist
awk '
  match($0, /^<script src="[a-z]+\.js"><\/script>$/) {
    f = substr($0, 14, length($0) - 24)
    print "<script>"; while ((getline l < f) > 0) print l; close(f); print "</script>"; next }
  { print }' index.html > dist/pokesurvivor.html
echo "dist/pokesurvivor.html"
