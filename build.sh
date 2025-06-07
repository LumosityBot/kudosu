#!/bin/bash

echo "🔧 Installation des dépendances..."
npm install

echo "🌐 Installation de Chrome pour Puppeteer..."
npx puppeteer browsers install chrome

echo "✅ Build terminé avec succès!"