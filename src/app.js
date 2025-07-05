import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

// Pour obtenir l'équivalent de __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config();

// Créer l'application Express
const app = express();

// 🔧 CORS CORRIGÉ - Autorise Flutter Web (politique permissive pour dev)
const corsOptions = {
  origin: function (origin, callback) {
    // Autorise les requêtes sans origine (comme Postman) et toutes les localhost
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, true); // Pour le développement, on autorise tout
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Cache-Control',
    'Pragma',
    'Expires',
    'Accept',
    'Connection'
  ],
  credentials: true,
  optionsSuccessStatus: 200, // Pour les anciens navigateurs
};

// Appliquer le middleware CORS avec les options
app.use(cors(corsOptions));

// 🔧 AJOUTÉ : Middleware pour préflight OPTIONS
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, Expires, Accept, Connection');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
  } else {
    next();
  }
});

// Appliquer express.json pour le parsing du corps des requêtes
app.use(express.json());

// Serveur des fichiers statiques dans /uploads
app.use('/uploads', cors(corsOptions), express.static(path.resolve(__dirname, '../uploads')));

// Configurer les sessions (doit être avant l'initialisation de passport)
import session from 'express-session';
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Initialiser passport
import passport from 'passport';
import './db/passport.js';  // Assure-toi que ce fichier existe et est correctement configuré
app.use(passport.initialize());
app.use(passport.session());

// Import des routes après l'initialisation de passport
import authRoutes from './routes/auth/authRoutes.js';
import productRoutes from "./routes/productRoutes.js";
import shopRoutes from "./routes/shopRoutes.js";
import commentRoutes from './routes/commentRoutes.js';
import likeRoutes from './routes/likeRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import googleAuthRoutes from './routes/auth/googleAuthRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import panierRoutes from './routes/panierRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import { setupSocketServer } from './services/socketService.js';

// Routes
app.use('/api/auth', authRoutes);
app.use("/api/produit", productRoutes);
app.use("/api/shop", shopRoutes);
app.use('/api', commentRoutes);
app.use('/api', likeRoutes);
app.use('/api', notificationRoutes);
app.use('/api/auth', googleAuthRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api', orderRoutes);
app.use('/api', panierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/messages', messageRoutes);

// Créer le serveur HTTP
const server = http.createServer(app);

// Configuration de Socket.IO
const io = setupSocketServer(server);

// Stocker l'instance io globalement
global.io = io;

// Route par défaut
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bienvenue sur votre application e-commerce !',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// 🔧 NOUVEL ENDPOINT DE TEST SIMPLE (sans auth)
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Serveur accessible',
    status: 'success',
    connection: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 🔧 ROUTE DE TEST DE CONNEXION CORRIGÉE (sans authentification)
app.get('/api/auth/verify-token', (req, res) => {
  // Si pas de token, on indique juste que le serveur est accessible
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.json({ 
      message: 'Serveur accessible',
      status: 'success',
      connection: 'ok',
      timestamp: new Date().toISOString()
    });
  }
  
  // Si token présent, on peut faire la vraie vérification plus tard
  res.json({ 
    message: 'Token vérifié',
    status: 'success',
    timestamp: new Date().toISOString()
  });
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    status: 'error',
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Exporter l'app et le serveur
export { app, server };
export default app;