// errorMessages.js - Centralise tous les messages d'erreur de l'application

const authErrors = {
    // Erreurs d'inscription
    registration: {
      emailExists: "Cette adresse email est déjà utilisée par un autre compte",
      phoneExists: "Ce numéro de téléphone est déjà utilisé par un autre compte",
      invalidRole: "Le rôle spécifié n'est pas valide",
      emailRequired: "L'adresse email est requise",
      passwordRequired: "Le mot de passe est requis",
      weakPassword: "Le mot de passe doit contenir au moins 8 caractères, incluant majuscules, minuscules et chiffres",
      invalidEmail: "Veuillez fournir une adresse email valide",
      uploadFailed: "Échec du téléchargement de la photo de profil",
    },
    
    // Erreurs de vérification
    verification: {
      userNotFound: "Aucun compte associé à cette adresse email n'a été trouvé",
      codeExpired: "Code de vérification expiré. Veuillez demander un nouveau code",
      incorrectCode: "Code de vérification incorrect",
      alreadyVerified: "Ce compte est déjà vérifié",
      emailRequired: "Email requis pour la vérification",
      codeRequired: "Code de vérification requis",
    },
    
    // Erreurs de connexion
    login: {
      invalidCredentials: "Email ou mot de passe incorrect",
      notVerified: "Votre compte n'est pas vérifié. Un nouveau code de vérification a été envoyé à votre email",
      accountLocked: "Votre compte a été temporairement verrouillé suite à plusieurs tentatives infructueuses",
    },
    
    // Erreurs de mot de passe
    password: {
      currentRequired: "Le mot de passe actuel est requis",
      newRequired: "Le nouveau mot de passe est requis",
      incorrectCurrent: "Mot de passe actuel incorrect",
      weakPassword: "Le nouveau mot de passe doit contenir au moins 8 caractères, incluant majuscules, minuscules et chiffres",
      resetCodeExpired: "Code de réinitialisation expiré",
      resetCodeIncorrect: "Code de réinitialisation incorrect",
    },
    
    // Erreurs d'authentification
    auth: {
      tokenRequired: "Token d'authentification requis",
      invalidToken: "Token invalide ou expiré",
      unauthorized: "Accès non autorisé",
      adminOnly: "Accès réservé aux administrateurs",
    },
    
    // Erreurs de profil
    profile: {
      userNotFound: "Utilisateur non trouvé",
      updateFailed: "Échec de la mise à jour du profil",
      deleteFailed: "Échec de la suppression du compte",
    },
    
    // Erreurs liées aux emails
    email: {
      sendFailed: "Échec de l'envoi de l'email",
      noRecipient: "Aucun destinataire défini pour l'email",
      invalidConfig: "Configuration de messagerie invalide",
    },
    
    // Erreurs liées à Cloudinary
    cloudinary: {
      uploadFailed: "Échec du téléchargement de l'image vers Cloudinary",
      deleteFailed: "Échec de la suppression de l'ancienne image",
      invalidFile: "Type de fichier non autorisé, veuillez utiliser JPG, PNG ou JPEG",
      fileTooLarge: "La taille de l'image ne doit pas dépasser 2 Mo",
    },
  };
  
  const userErrors = {
    notFound: "Utilisateur non trouvé",
    alreadyExists: "Un utilisateur avec ces informations existe déjà",
    invalidInput: "Données utilisateur non valides",
  };
  


  const productErrors = {
    // Erreurs générales
    notFound: "Produit non trouvé",
    userNotFound: "Utilisateur non trouvé",
    notMerchant: "Seuls les commerçants peuvent créer des produits",
    noShop: "Vous devez d'abord créer une boutique",
    createFailed: "Échec de la création du produit",
    updateFailed: "Échec de la mise à jour du produit",
    deleteFailed: "Échec de la suppression du produit",
    
    // Erreurs de validation
    invalidData: "Données de produit non valides",
    invalidPriceStock: "Le prix et le stock doivent être des nombres valides",
    nameRequired: "Le nom du produit est requis",
    descriptionRequired: "La description du produit est requise",
    categoryRequired: "La catégorie du produit est requise",
    invalidStatus: "Le statut doit être 'DRAFT' ou 'PUBLISHED'",
    
    // Erreurs d'upload
    noImages: "Aucune image fournie",
    uploadFailed: "Échec du téléchargement des images",
    videoUploadFailed: "Échec du téléchargement de la vidéo",
    
    // Erreurs d'accès
    notAuthorized: "Vous n'êtes pas autorisé à modifier ce produit",
    
    // Erreurs de stock
    invalidStock: "Veuillez fournir une valeur de stock valide",
    outOfStock: "Produit en rupture de stock"
  };
  const orderErrors = {
    notFound: "Commande non trouvée",
    createFailed: "Échec de la création de la commande",
    updateFailed: "Échec de la mise à jour de la commande",
    deleteFailed: "Échec de la suppression de la commande",
    invalidStatus: "Statut de commande non valide",
    paymentFailed: "Échec du paiement de la commande",
  };
  
  const serverErrors = {
    internal: "Erreur interne du serveur",
    database: "Erreur de base de données",
    validation: "Erreur de validation des données",
    notImplemented: "Fonctionnalité non implémentée",
    serviceUnavailable: "Service temporairement indisponible",
  };
  // Ajouter ces messages d'erreur dans votre fichier utils/errorMessages.js

const shopErrors = {
    // Erreurs de création
    creation: {
      notMerchant: "Seuls les commerçants peuvent créer une boutique",
      alreadyHasShop: "Vous possédez déjà une boutique",
      phoneNumberExists: "Ce numéro de téléphone est déjà utilisé par une autre boutique",
      uploadFailed: "Échec du téléchargement du logo de la boutique",
      invalidData: "Veuillez fournir des informations valides pour votre boutique"
    },
    
    // Erreurs de récupération
    retrieval: {
      notFound: "Boutique non trouvée",
      invalidId: "ID de boutique invalide",
      noShopOwned: "Vous n'avez pas encore de boutique",
      noProductsFound: "Aucun produit disponible pour cette boutique"
    },
    
    // Erreurs de mise à jour
    update: {
      notAuthorized: "Vous n'êtes pas autorisé à modifier cette boutique",
      phoneNumberExists: "Ce numéro de téléphone est déjà utilisé par une autre boutique",
      uploadFailed: "Échec du téléchargement du nouveau logo"
    },
    
    // Erreurs de suppression
    deletion: {
      notAuthorized: "Vous n'êtes pas autorisé à supprimer cette boutique",
      hasOrders: "Impossible de supprimer une boutique ayant des commandes actives"
    },
    
    // Erreurs de contact
    contact: {
      notAuthenticated: "Vous devez être connecté pour contacter un commerçant",
      selfContact: "Vous ne pouvez pas envoyer un message à votre propre boutique",
      missingFields: "Le sujet et le message sont obligatoires",
      emailFailed: "Impossible d'envoyer l'email au commerçant",
      invalidMessageId: "ID de message invalide",
      responseNotAuthorized: "Vous n'êtes pas autorisé à répondre à ce message",
      missingResponse: "La réponse est obligatoire" 
    }
  };
  
  // Exporter le module shopErrors
  export { shopErrors };
  
  
  export {
    authErrors,
    userErrors,
    productErrors,
    orderErrors,
    serverErrors
  };