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

// ✅ LISTES DES TYPES MIME AUTORISÉS (AVEC SUPPORT FLUTTER)
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 
  'image/jpg', 
  'image/png', 
  'image/gif', 
  'image/webp',
  'image/bmp',
  'image/tiff'
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 
  'video/webm', 
  'video/ogg', 
  'video/quicktime',
  'video/avi',
  'video/mov',
  'video/wmv',
  'video/3gp'
];

// ✅ EXTENSIONS D'IMAGES AUTORISÉES (POUR FLUTTER)
const ALLOWED_IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'
];

// ✅ EXTENSIONS VIDÉOS AUTORISÉES (POUR FLUTTER)
const ALLOWED_VIDEO_EXTENSIONS = [
  '.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.3gp'
];

// ✅ FONCTION UTILITAIRE AMÉLIORÉE POUR FLUTTER
const getFileTypeByMime = (mimetype) => {
  if (ALLOWED_IMAGE_TYPES.includes(mimetype)) {
    return 'image';
  } else if (ALLOWED_VIDEO_TYPES.includes(mimetype)) {
    return 'video';
  }
  return null;
};

// ✅ FONCTION UTILITAIRE PAR EXTENSION (POUR application/octet-stream)
const getFileTypeByExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  if (ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return 'image';
  } else if (ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    return 'video';
  }
  return null;
};

// ✅ FONCTION HYBRIDE QUI GÈRE FLUTTER
const getFileType = (mimetype, filename) => {
  console.log(`🔍 Détection type - MIME: ${mimetype}, Fichier: ${filename}`);
  
  // 1. Essayer d'abord par type MIME
  const typeByMime = getFileTypeByMime(mimetype);
  if (typeByMime) {
    console.log(`✅ Type détecté par MIME: ${typeByMime}`);
    return typeByMime;
  }
  
  // 2. Si MIME générique (application/octet-stream), utiliser l'extension
  if (mimetype === 'application/octet-stream') {
    const typeByExt = getFileTypeByExtension(filename);
    if (typeByExt) {
      console.log(`✅ Type détecté par extension: ${typeByExt} (MIME était générique)`);
      return typeByExt;
    }
  }
  
  console.log(`❌ Type non reconnu - MIME: ${mimetype}, Extension: ${path.extname(filename)}`);
  return null;
};

// ✅ FILTRE GÉNÉRIQUE AMÉLIORÉ POUR FLUTTER
const generalFileFilter = (req, file, cb) => {
  console.log(`📁 Vérification fichier Flutter - Nom: ${file.originalname}, Type MIME: ${file.mimetype}`);
  
  const fileType = getFileType(file.mimetype, file.originalname);
  
  if (fileType === 'image') {
    console.log(`✅ Fichier accepté comme image: ${file.originalname}`);
    file.fileType = 'image';
    cb(null, true);
  } else if (fileType === 'video') {
    console.log(`✅ Fichier accepté comme vidéo: ${file.originalname}`);
    file.fileType = 'video';
    cb(null, true);
  } else {
    console.log(`❌ Type de fichier non autorisé pour: ${file.originalname}`);
    console.log(`📋 MIME reçu: ${file.mimetype}`);
    console.log(`📋 Extension: ${path.extname(file.originalname)}`);
    console.log(`📋 Types MIME acceptés:`, ALLOWED_IMAGE_TYPES.concat(ALLOWED_VIDEO_TYPES));
    console.log(`📋 Extensions acceptées:`, ALLOWED_IMAGE_EXTENSIONS.concat(ALLOWED_VIDEO_EXTENSIONS));
    
    const error = new Error(`Type de fichier non autorisé: ${file.originalname}. Formats acceptés: ${ALLOWED_IMAGE_EXTENSIONS.concat(ALLOWED_VIDEO_EXTENSIONS).join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// ✅ STORAGE AMÉLIORÉ POUR FLUTTER
const multiUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      console.log(`📂 Détermination destination - Fichier: ${file.originalname}`);
      
      const fileType = getFileType(file.mimetype, file.originalname);
      
      if (fileType === 'image') {
        console.log(`📁 Destination: ${imagesDir}`);
        cb(null, imagesDir);
      } else if (fileType === 'video') {
        console.log(`📁 Destination: ${videosDir}`);
        cb(null, videosDir);
      } else {
        console.log(`❌ Destination impossible pour: ${file.originalname}`);
        const error = new Error(`Type de fichier non autorisé: ${file.originalname}`);
        error.code = 'INVALID_FILE_TYPE';
        cb(error, null);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const fileType = getFileType(file.mimetype, file.originalname);
      const prefix = fileType === 'image' ? 'img' : 'video';
      const filename = `${prefix}-${uniqueSuffix}${ext}`;
      console.log(`📝 Nom de fichier généré: ${filename}`);
      cb(null, filename);
    }
  }),
  fileFilter: generalFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 6 // Maximum 5 images + 1 vidéo
  }
});

// ✅ MIDDLEWARE AMÉLIORÉ POUR VÉRIFIER LES LIMITES SPÉCIFIQUES
const checkFileSizeLimits = (req, res, next) => {
  console.log(`🔍 Vérification des limites de taille...`);
  
  if (!req.files || Object.keys(req.files).length === 0) {
    console.log(`📁 Aucun fichier à vérifier`);
    return next();
  }
  
  const errors = [];
  let totalFiles = 0;
  
  try {
    Object.keys(req.files).forEach(fieldName => {
      const files = req.files[fieldName];
      console.log(`📋 Champ: ${fieldName}, Nombre de fichiers: ${files.length}`);
      
      files.forEach((file, index) => {
        totalFiles++;
        console.log(`📄 Fichier ${index + 1}: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
        
        const fileType = getFileType(file.mimetype, file.originalname);
        
        // Vérifications spécifiques par type
        if (fileType === 'image') {
          if (file.size > 5 * 1024 * 1024) { // 5MB pour images
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            errors.push(`L'image "${file.originalname}" (${sizeMB}MB) dépasse la limite de 5MB`);
          }
        } else if (fileType === 'video') {
          if (file.size > 50 * 1024 * 1024) { // 50MB pour vidéos
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            errors.push(`La vidéo "${file.originalname}" (${sizeMB}MB) dépasse la limite de 50MB`);
          }
        }
      });
    });
    
    console.log(`📊 Total des fichiers traités: ${totalFiles}`);
    
    if (errors.length > 0) {
      console.log(`❌ Erreurs de taille détectées:`, errors);
      
      // Supprimer les fichiers déjà uploadés
      Object.keys(req.files).forEach(fieldName => {
        req.files[fieldName].forEach(file => {
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
              console.log(`🗑️ Fichier supprimé: ${file.path}`);
            }
          } catch (deleteError) {
            console.error(`❌ Erreur suppression fichier ${file.path}:`, deleteError);
          }
        });
      });
      
      return res.status(400).json({ 
        status: 'error',
        code: 'FILE_SIZE_EXCEEDED',
        message: 'Certains fichiers dépassent les limites de taille autorisées',
        errors 
      });
    }
    
    console.log(`✅ Toutes les vérifications de taille sont passées`);
    next();
    
  } catch (error) {
    console.error(`❌ Erreur dans checkFileSizeLimits:`, error);
    return res.status(500).json({
      status: 'error',
      code: 'FILE_CHECK_ERROR',
      message: 'Erreur lors de la vérification des fichiers',
      error: error.message
    });
  }
};

// ✅ MIDDLEWARE DE DEBUG AMÉLIORÉ
const debugFileUpload = (req, res, next) => {
  console.log(`\n🚀 === DÉBUT UPLOAD DEBUG FLUTTER ===`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 Route: ${req.method} ${req.path}`);
  console.log(`👤 User ID: ${req.user?.id || 'Non authentifié'}`);
  
  // Debug du body
  console.log(`📝 Body:`, Object.keys(req.body).length > 0 ? req.body : 'Vide');
  
  // Debug des fichiers
  if (req.files && Object.keys(req.files).length > 0) {
    console.log(`📁 Fichiers reçus depuis Flutter:`, Object.keys(req.files).map(key => ({
      field: key,
      count: req.files[key].length,
      files: req.files[key].map(f => ({
        name: f.originalname,
        type: f.mimetype,
        size: `${(f.size / 1024).toFixed(2)}KB`,
        path: f.path,
        extension: path.extname(f.originalname)
      }))
    })));
  } else {
    console.log(`📁 Aucun fichier reçu depuis Flutter`);
  }
  
  console.log(`🚀 === FIN UPLOAD DEBUG FLUTTER ===\n`);
  next();
};

// ✅ MIDDLEWARE DE GESTION D'ERREURS MULTER SPÉCIFIQUE FLUTTER
const handleMulterError = (error, req, res, next) => {
  console.error(`❌ Erreur Multer (Flutter):`, error);
  
  if (error instanceof multer.MulterError) {
    let message = 'Erreur lors de l\'upload';
    let code = 'UPLOAD_ERROR';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'Fichier trop volumineux (max 50MB)';
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Trop de fichiers (max 5 images + 1 vidéo)';
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Champ de fichier inattendu. Utilisez "productImages" pour les images et "video" pour les vidéos';
        code = 'UNEXPECTED_FIELD';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Trop de parties dans la requête';
        code = 'TOO_MANY_PARTS';
        break;
    }
    
    return res.status(400).json({
      status: 'error',
      code,
      message,
      details: error.message
    });
  }
  
  if (error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_FILE_TYPE',
      message: error.message,
      acceptedFormats: {
        images: ALLOWED_IMAGE_EXTENSIONS,
        videos: ALLOWED_VIDEO_EXTENSIONS
      }
    });
  }
  
  // Erreur générique
  console.error(`❌ Erreur upload non gérée:`, error);
  return res.status(500).json({
    status: 'error',
    code: 'UPLOAD_ERROR',
    message: 'Erreur interne lors de l\'upload',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Contactez le support'
  });
};

// Exportation des fonctions d'upload
export default {
  // ✅ Upload principal pour produits Flutter
  uploadProductMedia: multiUpload.fields([
    { name: 'productImages', maxCount: 5 },
    { name: 'video', maxCount: 1 }
  ]),
  
  // Middlewares
  checkFileSizeLimits,
  debugFileUpload,
  handleMulterError,
  
  // Uploads spécifiques
  uploadUserAvatar: multiUpload.single('avatar'),
  uploadShopLogo: multiUpload.single('logo'),
  
  // Constantes utiles
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_VIDEO_EXTENSIONS,
  getFileType
};