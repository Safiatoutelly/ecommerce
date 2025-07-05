import { app, server } from './src/app.js'; // Import de l'app et du serveur
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // 🔧 Écoute sur toutes les interfaces

// 🔧 LANCER LE SERVEUR AVEC SUPPORT SOCKET.IO
server.listen(PORT, HOST, () => {
    console.log('🚀 ===== SERVEUR DÉMARRÉ =====');
    console.log(`📡 Serveur HTTP: http://localhost:${PORT}`);
    console.log(`🌐 Accessible via: http://0.0.0.0:${PORT}`);
    console.log(`🔌 WebSocket: Activé`);
    console.log(`📁 Uploads: /uploads`);
    console.log(`⚡ Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log('================================');
    
    // 🔧 AJOUTÉ : Test des endpoints principaux au démarrage
    console.log('🔍 Endpoints disponibles:');
    console.log(`   - GET  http://localhost:${PORT}/`);
    console.log(`   - GET  http://localhost:${PORT}/api/auth/verify-token`);
    console.log(`   - POST http://localhost:${PORT}/api/auth/login`);
    console.log(`   - POST http://localhost:${PORT}/api/auth/register`);
    console.log('================================');
});

// Gestion des erreurs de serveur
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Erreur: Le port ${PORT} est déjà utilisé`);
        console.log('💡 Solutions:');
        console.log('   1. Changez le port dans votre fichier .env');
        console.log('   2. Ou arrêtez le processus qui utilise ce port');
        console.log(`   3. Ou utilisez: kill -9 $(lsof -ti:${PORT})`);
    } else {
        console.error('❌ Erreur serveur:', err);
    }
    process.exit(1);
});

// Gestion de l'arrêt propre du serveur
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur en cours...');
    server.close(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Signal SIGTERM reçu, arrêt du serveur...');
    server.close(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
    });
});

// Gestion des erreurs non gérées
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});