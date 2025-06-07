const puppeteer = require('puppeteer');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('cron');
require('dotenv').config();

// Configuration Express pour garder l'application active
const app = express();
const PORT = process.env.PORT || 3000;

// Routes de base
app.get('/', (req, res) => {
    res.json({
        status: 'active',
        message: '🤖 Sudoku Bot is running!',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        memory: process.memoryUsage(),
        uptime: process.uptime()
    });
});

// Classe principale du bot
class SudokuBot {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isRunning = false;
        this.stats = {
            cycles: 0,
            errors: 0,
            lastRun: null,
            startTime: new Date()
        };
    }

    async initBrowser() {
        try {
            console.log('🚀 Initialisation du navigateur...');
            
            // Configuration Puppeteer pour Render
            this.browser = await puppeteer.launch({
                headless: 'new', // Utilise le nouveau mode headless
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding'
                ],
                timeout: 30000
            });

            this.page = await this.browser.newPage();
            
            // Configuration de la page
            await this.page.setViewport({ width: 1366, height: 768 });
            await this.page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            console.log('✅ Navigateur initialisé avec succès');
            return true;
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation du navigateur:', error);
            return false;
        }
    }

    async getPageTitle(url) {
        try {
            console.log(`🌐 Navigation vers: ${url}`);
            
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            const title = await this.page.title();
            console.log(`📄 Titre de la page: ${title}`);
            
            return title;
        } catch (error) {
            console.error(`❌ Erreur lors de la récupération du titre pour ${url}:`, error.message);
            return null;
        }
    }

    async analyzePage(url) {
        try {
            console.log(`🔍 Analyse de la page: ${url}`);
            
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Analyser la structure de la page
            const analysis = await this.page.evaluate(() => {
                const results = {
                    title: document.title,
                    inputs: document.querySelectorAll('input').length,
                    tables: document.querySelectorAll('table').length,
                    buttons: document.querySelectorAll('button').length,
                    forms: document.querySelectorAll('form').length,
                    sudokuElements: []
                };

                // Recherche d'éléments Sudoku potentiels
                const selectors = ['[class*="sudoku"]', '[id*="sudoku"]', '[class*="grid"]', '[id*="grid"]'];
                selectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        results.sudokuElements.push({
                            selector: selector,
                            count: elements.length
                        });
                    }
                });

                return results;
            });

            console.log('📊 Analyse de la page:');
            console.log(`  - Titre: ${analysis.title}`);
            console.log(`  - Inputs: ${analysis.inputs}`);
            console.log(`  - Tables: ${analysis.tables}`);
            console.log(`  - Boutons: ${analysis.buttons}`);
            console.log(`  - Formulaires: ${analysis.forms}`);
            
            if (analysis.sudokuElements.length > 0) {
                console.log('  - Éléments Sudoku détectés:');
                analysis.sudokuElements.forEach(elem => {
                    console.log(`    ${elem.selector}: ${elem.count} élément(s)`);
                });
            }

            return analysis;
        } catch (error) {
            console.error(`❌ Erreur lors de l'analyse de ${url}:`, error.message);
            return null;
        }
    }

    async testSudokuSites() {
        const sites = [
            'https://sudoku.lumitelburundi.com/game',
            'https://sudokuspoiler.com/sudoku/sudoku9'
        ];

        console.log('\n🔍 Test des sites Sudoku...');
        
        for (const site of sites) {
            try {
                const title = await this.getPageTitle(site);
                if (title) {
                    console.log(`✅ ${site} - Accessible`);
                    
                    // Analyse plus approfondie pour le site principal
                    if (site.includes('lumitelburundi')) {
                        await this.analyzePage(site);
                    }
                } else {
                    console.log(`❌ ${site} - Non accessible`);
                }
                
                // Pause entre les requêtes
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`❌ Erreur pour ${site}:`, error.message);
            }
        }
    }

    async runCycle() {
        if (this.isRunning) {
            console.log('⚠️ Un cycle est déjà en cours...');
            return;
        }

        this.isRunning = true;
        this.stats.cycles++;
        this.stats.lastRun = new Date();

        try {
            console.log(`\n⏰ Début du cycle #${this.stats.cycles} - ${new Date().toLocaleString()}`);
            
            // Initialiser le navigateur si nécessaire
            if (!this.browser) {
                const initSuccess = await this.initBrowser();
                if (!initSuccess) {
                    throw new Error('Impossible d\'initialiser le navigateur');
                }
            }

            // Tester les sites Sudoku
            await this.testSudokuSites();

            console.log(`✅ Cycle #${this.stats.cycles} terminé avec succès`);
        } catch (error) {
            this.stats.errors++;
            console.error(`❌ Erreur dans le cycle #${this.stats.cycles}:`, error.message);
            
            // Réinitialiser le navigateur en cas d'erreur
            await this.closeBrowser();
        } finally {
            this.isRunning = false;
        }
    }

    async closeBrowser() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                console.log('🧹 Navigateur fermé');
            }
        } catch (error) {
            console.error('❌ Erreur lors de la fermeture du navigateur:', error);
        }
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            uptime: Date.now() - this.stats.startTime.getTime()
        };
    }

    async start() {
        console.log('🚀 Démarrage du Sudoku Bot...');
        
        // Premier cycle immédiat
        await this.runCycle();
        
        // Programmer les cycles suivants toutes les 5 minutes
        const job = new cron.CronJob('*/5 * * * *', async () => {
            await this.runCycle();
        });
        
        job.start();
        console.log('📅 Planificateur démarré - Cycle toutes les 5 minutes');
    }
}

// Instance globale du bot
const bot = new SudokuBot();

// Route pour obtenir les statistiques
app.get('/stats', (req, res) => {
    res.json(bot.getStats());
});

// Route pour déclencher un cycle manuellement
app.get('/run', async (req, res) => {
    try {
        await bot.runCycle();
        res.json({ success: true, message: 'Cycle déclenché' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Gestion propre de l'arrêt
process.on('SIGTERM', async () => {
    console.log('🛑 Signal SIGTERM reçu, arrêt en cours...');
    await bot.closeBrowser();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Signal SIGINT reçu, arrêt en cours...');
    await bot.closeBrowser();
    process.exit(0);
});

// Démarrage du serveur
app.listen(PORT, async () => {
    console.log(`🌐 Serveur démarré sur le port ${PORT}`);
    console.log(`📊 Interface: http://localhost:${PORT}`);
    
    // Démarrer le bot après un délai
    setTimeout(async () => {
        await bot.start();
    }, 3000);
});

module.exports = { app, bot };
