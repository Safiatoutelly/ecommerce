// ✅ SCRIPT DE TEST POUR VÉRIFIER LES TYPES MIME
// Placez ce fichier dans votre dossier src/utils/ et exécutez-le pour tester

import upload from './multer.js';

// Fonction de test pour simuler la vérification des types MIME
const testMimeTypes = () => {
  console.log("\n🧪 === TEST DES TYPES MIME ===\n");
  
  // Types de fichiers à tester
  const testFiles = [
    // Images valides
    { mimetype: 'image/jpeg', expected: true, type: 'image' },
    { mimetype: 'image/jpg', expected: true, type: 'image' },
    { mimetype: 'image/png', expected: true, type: 'image' },
    { mimetype: 'image/gif', expected: true, type: 'image' },
    { mimetype: 'image/webp', expected: true, type: 'image' },
    
    // Vidéos valides
    { mimetype: 'video/mp4', expected: true, type: 'video' },
    { mimetype: 'video/webm', expected: true, type: 'video' },
    { mimetype: 'video/quicktime', expected: true, type: 'video' },
    
    // Types invalides
    { mimetype: 'application/pdf', expected: false, type: 'unknown' },
    { mimetype: 'text/plain', expected: false, type: 'unknown' },
    { mimetype: 'application/msword', expected: false, type: 'unknown' },
    { mimetype: 'audio/mp3', expected: false, type: 'unknown' },
    
    // Cas particuliers
    { mimetype: 'image/svg+xml', expected: false, type: 'unknown' },
    { mimetype: 'video/x-msvideo', expected: false, type: 'unknown' },
  ];
  
  console.log("📋 Types MIME autorisés:");
  console.log("🖼️  Images:", upload.ALLOWED_IMAGE_TYPES);
  console.log("🎥 Vidéos:", upload.ALLOWED_VIDEO_TYPES);
  console.log("\n");
  
  let passed = 0;
  let failed = 0;
  
  testFiles.forEach((testFile, index) => {
    const result = upload.getFileType(testFile.mimetype);
    const isValid = result !== null;
    const success = isValid === testFile.expected;
    
    console.log(`${index + 1}. ${testFile.mimetype}`);
    console.log(`   Attendu: ${testFile.expected ? '✅ Valide' : '❌ Invalide'}`);
    console.log(`   Résultat: ${isValid ? '✅ Valide' : '❌ Invalide'} (type: ${result || 'inconnu'})`);
    console.log(`   Status: ${success ? '🟢 PASSÉ' : '🔴 ÉCHOUÉ'}`);
    console.log("");
    
    if (success) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log(`\n📊 === RÉSULTATS ===`);
  console.log(`✅ Tests réussis: ${passed}`);
  console.log(`❌ Tests échoués: ${failed}`);
  console.log(`📈 Taux de réussite: ${((passed / testFiles.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log("🎉 Tous les tests sont passés !");
  } else {
    console.log("⚠️  Certains tests ont échoué. Vérifiez la configuration.");
  }
};

// Fonction pour tester un type MIME spécifique
export const testSpecificMimeType = (mimetype) => {
  console.log(`\n🔍 Test du type MIME: ${mimetype}`);
  
  const result = upload.getFileType(mimetype);
  const isImage = upload.ALLOWED_IMAGE_TYPES.includes(mimetype);
  const isVideo = upload.ALLOWED_VIDEO_TYPES.includes(mimetype);
  
  console.log(`📄 Type détecté: ${result || 'inconnu'}`);
  console.log(`🖼️  Est une image: ${isImage ? 'Oui' : 'Non'}`);
  console.log(`🎥 Est une vidéo: ${isVideo ? 'Oui' : 'Non'}`);
  console.log(`✅ Autorisé: ${result !== null ? 'Oui' : 'Non'}`);
  
  return result !== null;
};

// Fonction pour simuler une requête d'upload
export const simulateFileUpload = (files) => {
  console.log("\n🎭 === SIMULATION UPLOAD ===");
  
  files.forEach((file, index) => {
    console.log(`\nFichier ${index + 1}:`);
    console.log(`📄 Nom: ${file.originalname || 'non-spécifié'}`);
    console.log(`🏷️  Type MIME: ${file.mimetype}`);
    console.log(`📏 Taille: ${file.size ? `${(file.size / 1024).toFixed(2)}KB` : 'non-spécifiée'}`);
    
    const fileType = upload.getFileType(file.mimetype);
    
    if (fileType) {
      console.log(`✅ Fichier accepté comme: ${fileType}`);
      
      // Vérifier les limites de taille
      const imageLimits = 5 * 1024 * 1024; // 5MB
      const videoLimits = 50 * 1024 * 1024; // 50MB
      
      if (file.size) {
        if (fileType === 'image' && file.size > imageLimits) {
          console.log(`❌ Image trop volumineuse: ${(file.size / (1024 * 1024)).toFixed(2)}MB > 5MB`);
        } else if (fileType === 'video' && file.size > videoLimits) {
          console.log(`❌ Vidéo trop volumineuse: ${(file.size / (1024 * 1024)).toFixed(2)}MB > 50MB`);
        } else {
          console.log(`✅ Taille acceptable`);
        }
      }
    } else {
      console.log(`❌ Type de fichier non autorisé`);
      console.log(`💡 Types autorisés:`);
      console.log(`   Images: ${upload.ALLOWED_IMAGE_TYPES.join(', ')}`);
      console.log(`   Vidéos: ${upload.ALLOWED_VIDEO_TYPES.join(', ')}`);
    }
  });
};

// Exécuter les tests si ce fichier est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  testMimeTypes();
  
  // Exemple de test avec des fichiers simulés
  console.log("\n");
  simulateFileUpload([
    { originalname: 'test.jpg', mimetype: 'image/jpeg', size: 2048000 },
    { originalname: 'video.mp4', mimetype: 'video/mp4', size: 10485760 },
    { originalname: 'document.pdf', mimetype: 'application/pdf', size: 1024000 }
  ]);
}

export default {
  testMimeTypes,
  testSpecificMimeType,
  simulateFileUpload
};