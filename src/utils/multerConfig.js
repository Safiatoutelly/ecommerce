// src/utils/multerConfig.js - CORRECTION POUR application/octet-stream
import multer from 'multer';
import path from 'path';

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// 🔥 FILTRER AVEC VÉRIFICATION AVANCÉE
const fileFilter = (req, file, cb) => {
  console.log('📁 Fichier reçu:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype
  });
  
  // 🔥 SOLUTION 1: Vérifier l'extension du fichier en plus du MIME type
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
  
  // 🔥 SOLUTION 2: Accepter si c'est une image OU si l'extension est valide
  const isValidMimeType = file.mimetype.startsWith('image/');
  const isValidExtension = validImageExtensions.includes(fileExtension);
  const isOctetStreamWithImageExtension = file.mimetype === 'application/octet-stream' && isValidExtension;
  
  if (isValidMimeType || isOctetStreamWithImageExtension) {
    console.log('✅ Fichier accepté:', {
      mimetype: file.mimetype,
      extension: fileExtension,
      reason: isValidMimeType ? 'MIME type valide' : 'Extension image valide'
    });
    cb(null, true);
  } else {
    console.log('❌ Fichier rejeté:', {
      mimetype: file.mimetype,
      extension: fileExtension,
      validMime: isValidMimeType,
      validExt: isValidExtension
    });
    cb(new Error(`Type de fichier non autorisé. MIME: ${file.mimetype}, Extension: ${fileExtension}`), false);
  }
};

// Initialiser Multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

export default upload;