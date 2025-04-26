import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path'; // Ajoutez cette ligne pour utiliser path
import { fileURLToPath } from 'url'; // Ajoutez cette ligne pour utiliser __dirname en ES modules

// Pour obtenir l'équivalent de __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config();

// Créer l'application Express
const app = express();

// Appliquer CORS avant tous les autres middlewares
const corsOptions = {
  origin: ['http://localhost:8081'], // Autoriser uniquement le front-end à cette adresse
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Méthodes autorisées
  allowedHeaders: ['Content-Type', 'Authorization'], // En-têtes autorisés
  credentials: true, // Autoriser les cookies et les sessions
};

// Appliquer le middleware CORS avec les options
app.use(cors(corsOptions));

// Appliquer express.json pour le parsing du corps des requêtes
app.use(express.json());

// Serveur des fichiers statiques dans /uploads
app.use('/uploads', cors(corsOptions), express.static(path.resolve(__dirname, '../uploads')));

// Configurer les sessions (doit être avant l'initialisation de passport)
import session from 'express-session';
app.use(session({
  secret: process.env.SESSION_SECRET,
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
import     panierRoutes  from './routes/panierRoutes.js';


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



// Route par défaut
app.get('/', (req, res) => {
  res.send('Bienvenue sur votre application e-commerce !');
});

// Exporter l'app pour pouvoir l'utiliser ailleurs (par exemple dans server.js)
export default app;
