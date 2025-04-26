import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Assurer que le dossier d'upload existe
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Sous-dossiers pour différents types de médias
const imagesDir = path.join(uploadDir, 'images/');
const videosDir = path.join(uploadDir, 'videos/');

// Créer les sous-dossiers s'ils n'existent pas
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

// Configuration pour les images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `img-${uniqueSuffix}${ext}`);
  }
});

// Configuration pour les vidéos
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `video-${uniqueSuffix}${ext}`);
  }
});

// Filtre pour les images
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type d\'image non autorisé. Formats acceptés: JPEG, PNG, JPG, GIF, WEBP'), false);
  }
};

// Filtre pour les vidéos
const videoFileFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de vidéo non autorisé. Formats acceptés: MP4, WEBM, OGG, MOV'), false);
  }
};

// Filtre générique qui détecte automatiquement le type de fichier
const generalFileFilter = (req, file, cb) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
  const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  
  if (imageTypes.includes(file.mimetype)) {
    file.destination = imagesDir;
    file.fileType = 'image';
    cb(null, true);
  } else if (videoTypes.includes(file.mimetype)) {
    file.destination = videosDir;
    file.fileType = 'video';
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seuls les images et vidéos sont acceptés.'), false);
  }
};

// Limites de taille pour les fichiers
const imageLimits = {
  fileSize: 5 * 1024 * 1024 // 5MB
};

const videoLimits = {
  fileSize: 50 * 1024 * 1024 // 50MB
};

// Initialiser les instances Multer
const imageUpload = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: imageLimits
});

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: videoLimits
});

// Instance Multer pour uploader plusieurs types de fichiers
const multiUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Choisir la destination en fonction du type MIME
      const imageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
      const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
      
      if (imageTypes.includes(file.mimetype)) {
        cb(null, imagesDir);
      } else if (videoTypes.includes(file.mimetype)) {
        cb(null, videosDir);
      } else {
        cb(new Error('Type de fichier non autorisé'), false);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const prefix = file.mimetype.startsWith('image/') ? 'img' : 'video';
      cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    }
  }),
  fileFilter: generalFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max, on vérifiera spécifiquement par type dans le middleware
  }
});

// Middleware pour vérifier les limites spécifiques par type
const checkFileSizeLimits = (req, res, next) => {
  if (!req.files) return next();
  
  const errors = [];
  
  Object.keys(req.files).forEach(fieldName => {
    req.files[fieldName].forEach(file => {
      if (file.mimetype.startsWith('image/') && file.size > imageLimits.fileSize) {
        errors.push(`L'image ${file.originalname} dépasse la limite de taille de 5MB`);
      } else if (file.mimetype.startsWith('video/') && file.size > videoLimits.fileSize) {
        errors.push(`La vidéo ${file.originalname} dépasse la limite de taille de 50MB`);
      }
    });
  });
  
  if (errors.length > 0) {
    // Supprimer les fichiers déjà uploadés
    Object.keys(req.files).forEach(fieldName => {
      req.files[fieldName].forEach(file => {
        fs.unlinkSync(file.path);
      });
    });
    
    return res.status(400).json({ errors });
  }
  
  next();
};

// Exportation des fonctions d'upload
export default {
  // Upload d'images uniquement
  uploadProductImages: imageUpload.array('productImages', 5),
  
  // Upload de vidéo uniquement
  uploadProductVideo: videoUpload.single('video'),
  
  // Upload d'images et de vidéo en même temps
  uploadProductMedia: multiUpload.fields([
    { name: 'productImages', maxCount: 5 },
    { name: 'video', maxCount: 1 }
  ]),
  
  // Middleware pour vérifier les limites de taille
  checkFileSizeLimits,
  
  // Pour les avatars utilisateurs
  uploadUserAvatar: imageUpload.single('avatar'),
  
  // Logo de boutique
  uploadShopLogo: imageUpload.single('logo'),
  
  // Pour d'autres cas d'utilisation spécifiques
  uploadGenericImage: imageUpload.single('image'),
  uploadGenericVideo: videoUpload.single('video')
};