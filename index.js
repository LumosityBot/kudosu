const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  sudokuSite: 'https://sudoku.lumitelburundi.com/game',
  solverSite: 'https://sudokuspoiler.com/sudoku/sudoku9',
  headless: true, // Toujours true pour Render
  timeout: 60000,
  maxAttempts: 3,
  retryDelay: 10000,
  // Variables d'environnement pour les credentials
  phoneNumber: process.env.PHONE_NUMBER || '',
  otpCode: process.env.OTP_CODE || '',
  useCookies: process.env.USE_COOKIES === 'true'
};

class SudokuBot {
  constructor() {
    this.browser = null;
    this.pages = [];
    this.roundNumber = 1;
    this.stats = {
      solved: 0,
      errors: 0,
      startTime: new Date()
    };
    this.cookies = null;
    this.loadCookies();
  }

  // Charger les cookies depuis le fichier JSON
  loadCookies() {
    try {
      const cookiesPath = path.join(__dirname, 'cookies.json');
      if (fs.existsSync(cookiesPath)) {
        const cookiesData = fs.readFileSync(cookiesPath, 'utf8');
        this.cookies = JSON.parse(cookiesData);
        console.log('✅ Cookies chargés depuis cookies.json');
      }
    } catch (error) {
      console.log('⚠️  Aucun fichier cookies.json trouvé ou erreur de lecture');
    }
  }

  // Méthode pour les délais
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async init() {
    try {
      console.log('🚀 Initialisation du bot Sudoku...');
      
      // Configuration pour Render
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        timeout: config.timeout
      };

      // Utiliser Chrome sur Render si disponible
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }

      this.browser = await puppeteer.launch(launchOptions);

      // Création des onglets
      this.pages.push(await this.browser.newPage());
      this.pages.push(await this.browser.newPage());

      // Configuration des pages
      for (const page of this.pages) {
        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.setDefaultNavigationTimeout(config.timeout);
        await page.setDefaultTimeout(config.timeout);
        
        // Charger les cookies si disponibles
        if (this.cookies && config.useCookies) {
          await page.setCookie(...this.cookies);
          console.log('✅ Cookies appliqués à la page');
        }
      }

      console.log('✅ Bot initialisé avec succès');
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation:', error);
      return false;
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
      }
      console.log('👋 Navigateur fermé');
    } catch (error) {
      console.error('Erreur lors de la fermeture:', error);
    }
  }

  async persistentClick(page, selector, description, maxAttempts = 3) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const element = await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await element.click();
        await this.delay(500);
        return true;
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          console.log(`Échec clic sur ${description}`);
        }
        await this.delay(1000);
      }
    }
    return false;
  }

  async handleLogin() {
    let attempt = 0;
    const page = this.pages[0];

    while (attempt < config.maxAttempts) {
      try {
        console.log(`\nTentative de connexion ${attempt + 1}/${config.maxAttempts}`);
        
        await page.goto(config.sudokuSite, { waitUntil: 'domcontentloaded' });
        await this.delay(2000);

        // Si les cookies fonctionnent, on devrait être connecté
        if (page.url().includes('/game')) {
          console.log('✅ Connexion automatique réussie via cookies!');
          return true;
        }

        // Vérifier si on est sur la page de login
        if (!page.url().includes('/game')) {
          console.log('Redirection détectée, démarrage du processus de connexion...');
          
          // Étape 1: Bouton Kwinjira
          console.log('Étape 1: Clique sur le bouton Kwinjira');
          await this.persistentClick(
            page,
            'button.w-53.py-3.px-6.bg-gradient-to-r.from-amber-400.to-amber-500.text-white.text-lg.font-bold.rounded-full.shadow-lg.mt-36',
            'Bouton Kwinjira'
          );
          
          await this.delay(2000);

          // Étape 2: Saisie du numéro de téléphone
          console.log('Étape 2: Saisie du numéro de téléphone');
          
          if (!config.phoneNumber) {
            throw new Error('PHONE_NUMBER non défini dans les variables d\'environnement');
          }
          
          await page.type(
            'input[placeholder="Nimushiremwo inomero ya terefone"]',
            config.phoneNumber,
            { delay: 50 }
          );
          await this.delay(1000);
          
          // Bouton Rungika OTP
          await this.persistentClick(
            page,
            'button.w-full.py-2.bg-red-700.text-white.rounded-md.font-semibold.hover\\:bg-red-600.transition.duration-200',
            'Bouton Rungika OTP'
          );
          await this.delay(2000);
          
          // Étape 3: Saisie du code OTP
          console.log('Étape 3: Saisie du code OTP');
          
          if (!config.otpCode) {
            throw new Error('OTP_CODE non défini dans les variables d\'environnement');
          }
          
          await page.type('input[placeholder="OTP"]', config.otpCode, { delay: 50 });
          await this.delay(1000);
          
          // Bouton Emeza
          await this.persistentClick(
            page,
            'button.w-full.py-2.bg-red-700.text-white.rounded-md.font-semibold.hover\\:bg-red-800.transition.duration-200',
            'Bouton Emeza'
          );
          
          console.log('Attente de 10 secondes...');
          await this.delay(10000);
          
          // Sauvegarder les cookies après connexion réussie
          const cookies = await page.cookies();
          fs.writeFileSync(path.join(__dirname, 'cookies_saved.json'), JSON.stringify(cookies, null, 2));
          console.log('✅ Cookies sauvegardés');
          
          // Aller à la page de jeu
          console.log('Navigation vers la page de jeu...');
          await page.goto(config.sudokuSite, { waitUntil: 'domcontentloaded' });
          await this.delay(3000);
          
          if (!page.url().includes('/game')) {
            throw new Error('Connexion non validée');
          }
        }

        console.log('Connexion réussie!');
        return true;
      } catch (error) {
        attempt++;
        console.log(`❌ Erreur connexion: ${error.message}`);
        
        if (attempt < config.maxAttempts) {
          console.log(`Nouvelle tentative dans ${config.retryDelay/1000}s...`);
          await this.delay(config.retryDelay);
        }
      }
    }
    
    console.log(`Échec après ${config.maxAttempts} tentatives`);
    return false;
  }

  async getSudokuGrid(page) {
    try {
      await page.waitForSelector('div.grid.grid-cols-9.gap-0.border-4.border-black', { visible: true });
      
      const cells = await page.$$('div.grid.grid-cols-9.gap-0.border-4.border-black div.w-10.h-10');
      
      if (cells.length !== 81) {
        throw new Error('Nombre de cellules incorrect');
      }

      const values = await Promise.all(
        cells.map(cell => page.evaluate(el => el.textContent.trim(), cell))
      );

      return values;
    } catch (error) {
      console.log(`Erreur récupération grille: ${error.message}`);
      return null;
    }
  }

  async fillSolution(page, solvedValues) {
    try {
      const cells = await page.$$('div.grid.grid-cols-9.gap-0.border-4.border-black div.w-10.h-10');
      const numberButtons = await page.$$('div.flex.gap-2.mt-4 button');

      for (let i = 0; i < cells.length; i++) {
        const currentValue = await page.evaluate(el => el.textContent.trim(), cells[i]);
        const targetValue = solvedValues[i];

        if (currentValue === targetValue) continue;

        if (!currentValue && targetValue) {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await cells[i].click();
              await this.delay(300);

              const classList = await page.evaluate(el => el.className, cells[i]);
              if (classList.includes('bg-blue-200')) {
                const btnIndex = parseInt(targetValue) - 1;
                await numberButtons[btnIndex].click();
                await this.delay(500);

                const newValue = await page.evaluate(el => el.textContent.trim(), cells[i]);
                if (newValue === targetValue) break;
              }
            } catch (error) {
              await this.delay(1000);
            }
          }
        }
      }
      return true;
    } catch (error) {
      console.log(`Erreur remplissage: ${error.message}`);
      return false;
    }
  }

  async solveOneSudoku() {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎯 ROUND ${this.roundNumber}`);
    console.log(`${'='.repeat(50)}`);
    
    const gamePage = this.pages[0];
    const solverPage = this.pages[1];
    let retries = 0;

    while (retries < config.maxAttempts) {
      try {
        // Étape 1: Récupération de la grille
        console.log('Étape 1: Chargement de la grille...');
        await gamePage.goto(config.sudokuSite, { waitUntil: 'domcontentloaded' });
        await this.delay(3000);
        
        const gridValues = await this.getSudokuGrid(gamePage);
        if (!gridValues) throw new Error('Impossible de récupérer la grille');
        
        // Étape 2: Résolution
        console.log('Étape 2: Résolution...');
        await solverPage.goto(config.solverSite, { waitUntil: 'domcontentloaded' });
        await this.delay(3000);
        
        await this.persistentClick(solverPage, '#resetButton', 'Reset');
        await this.delay(1000);
        
        const inputs = await solverPage.$$('#grid input');
        for (let i = 0; i < 81; i++) {
          if (gridValues[i]) {
            await inputs[i].type(gridValues[i], { delay: 10 });
            await this.delay(100);
          }
        }
        
        await this.persistentClick(solverPage, '#solveButton', 'Solve');
        await this.delay(3000);
        
        const solvedValues = await Promise.all(
          inputs.slice(0, 81).map(input => 
            solverPage.evaluate(el => el.value, input)
          )
        );
        
        // Étape 3: Retour à l'application principale
        console.log('Étape 3: Remplissage solution...');
        await gamePage.bringToFront();
        await gamePage.reload({ waitUntil: 'domcontentloaded' });
        await this.delay(3000);
        
        if (!await this.fillSolution(gamePage, solvedValues)) {
          throw new Error('Échec du remplissage');
        }
        
        // Étape 4: Nouveau Sudoku
        console.log('Étape 4: Chargement nouveau Sudoku...');
        if (await this.persistentClick(
          gamePage,
          'button.py-2.px-4.bg-red-800.text-white.rounded-full.ml-5',
          'Nouveau Sudoku'
        )) {
          await this.delay(4000);
          this.stats.solved++;
          this.roundNumber++;
          
          // Log des stats toutes les 10 rounds
          if (this.roundNumber % 10 === 0) {
            console.log(`📊 Stats: ${this.stats.solved} sudokus résolus`);
          }
          
          return true;
        }
      } catch (error) {
        retries++;
        console.log(`❌ Erreur (tentative ${retries}): ${error.message}`);
        await this.delay(config.retryDelay);
      }
    }
    
    console.log('🔁 Réinitialisation complète');
    await this.close();
    return false;
  }

  async start() {
    try {
      if (!await this.init()) return;
      
      if (!await this.handleLogin()) {
        throw new Error('Échec connexion après plusieurs tentatives');
      }

      // Initialisation solveur
      await this.pages[1].goto(config.solverSite, { waitUntil: 'domcontentloaded' });
      await this.delay(3000);

      // Boucle principale
      while (true) {
        const success = await this.solveOneSudoku();
        if (!success) {
          await this.init();
          await this.handleLogin();
        }
        await this.delay(2000);
      }
    } catch (error) {
      console.log(`❌ Erreur fatale: ${error.message}`);
    } finally {
      await this.close();
      process.exit(0);
    }
  }
}

// Gestion des signaux pour Render
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt par utilisateur');
  const bot = new SudokuBot();
  await bot.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Arrêt par système');
  const bot = new SudokuBot();
  await bot.close();
  process.exit(0);
});

// Créer un serveur HTTP simple pour que Render pense que c'est une app web
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Sudoku Bot is running!');
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`🌐 Serveur démarré sur le port ${port}`);
});

// Lancement du bot
const bot = new SudokuBot();
bot.start();