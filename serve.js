import app from './src/app.js'; // Assure-toi que l'import correspond au bon chemin

import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const PORT = process.env.PORT || 3000;

// Lancer le serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});