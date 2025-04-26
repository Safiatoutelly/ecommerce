import nodemailer from 'nodemailer';

// Configurer le transporteur d'email
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // adresse du serveur SMTP Gmail
  port: 587, // Port SMTP standard
  secure: false, // false pour 587
  auth: {
    user: process.env.EMAIL_USER, // ton adresse email
    pass: process.env.EMAIL_PASS, // ton mot de passe
  },
});


// Fonction pour envoyer un email de vérification
export const sendVerificationEmail = async (email, verificationCode) => {
  const mailOptions = {
    from: `"Votre Application" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Vérification de votre compte',
    html: `
     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; background-color: #ffffff;">
    <h2 style="color: #ff9900; text-align: center; font-size: 28px;">Vérification de votre compte - Bibocom_Market</h2>
    <p style="font-size: 16px; color: #333;">Merci de vous être inscrit sur notre plateforme. Pour terminer votre inscription, veuillez utiliser le code de vérification suivant :</p>
    <div style="background-color: #fff5e6; padding: 20px; text-align: center; font-size: 30px; color: #ff9900; letter-spacing: 5px; margin: 20px 0; border: 1px solid #ff9900; border-radius: 5px;">
        <strong>${verificationCode}</strong>
    </div>
    <p style="font-size: 16px; color: #333;">Ce code est valide pendant 24 heures.</p>
    <p style="font-size: 16px; color: #333;">Si vous n'avez pas demandé cette vérification, veuillez ignorer cet email.</p>
    <p style="font-size: 16px; color: #333;">Cordialement,<br><strong>L'équipe de Bibocom_Market</strong></p>
</div>

    `,
  };

  return transporter.sendMail(mailOptions);
};

export const sendContactMerchantEmail = async (merchantEmail, subject, customerEmail, customerMessage, shopName) => {
 // Définir l'URL frontend avec une valeur par défaut sécurisée
 const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';

 const mailOptions = {
   from: `"Bibocom Market" <${process.env.EMAIL_FROM}>`,
   to: merchantEmail,
   subject: `Nouveau message client pour ${shopName}`,
   replyTo: customerEmail, // Permet de répondre directement au client
   html: `
   <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
     <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #ff9900; padding-bottom: 15px;">
       <h2 style="color: #ff9900; font-size: 24px; margin: 0;">Nouveau message client</h2>
       <p style="color: #666; font-size: 16px; margin-top: 5px;">Pour votre boutique <strong>${shopName}</strong></p>
     </div>
     
     <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
       <p style="font-size: 16px; color: #333; margin-top: 0;">
         <strong style="color: #ff9900;">Sujet:</strong> ${subject}
       </p>
       <p style="font-size: 16px; color: #333;">
         <strong style="color: #ff9900;">Email:</strong> ${customerEmail}
       </p>
     </div>
     
     <div style="border-left: 4px solid #ff9900; padding-left: 15px; margin-bottom: 20px;">
       <h3 style="color: #333; font-size: 18px; margin-top: 0;">Message du client:</h3>
       <p style="color: #555; font-size: 16px; line-height: 1.5; white-space: pre-line;">${customerMessage}</p>
     </div>
     
     <div style="background-color: #fff5e6; padding: 15px; border-radius: 8px; margin-top: 25px;">
       <p style="color: #333; font-size: 14px; margin: 0;">
         <strong>Conseil:</strong> Répondez rapidement à ce client en utilisant le bouton "Répondre" de votre messagerie. 
         L'email est déjà configuré pour répondre directement au client.
       </p>
     </div>
     
     <div style="text-align: center; margin-top: 30px;">
       <p style="color: #555; margin-bottom: 10px;">Ou consultez tous vos messages :</p>
       <a href="${frontendUrl}/dashboard/messages" style="background-color: #ff9900; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
         Voir tous mes messages
       </a>
     </div>
     
     <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px;">
       <p>Ce message a été envoyé automatiquement depuis la plateforme Bibocom Market.</p>
       <p>© 2025 Bibocom Market - Tous droits réservés</p>
     </div>
   </div>
   `,
 };

 return transporter.sendMail(mailOptions);
};

// Fonction pour envoyer une confirmation au client
export const sendConfirmationToCustomer = async (customerEmail, subject, shopName, merchantFirstName) => {
  // Définir l'URL frontend avec une valeur par défaut sécurisée
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
 
  // URL complète et absolue
  const boutiquesUrl = `${frontendUrl.replace(/\/+$/, '')}/boutiques`;
 
  const mailOptions = {
    from: `"Bibocom Market" <${process.env.EMAIL_FROM}>`,
    to: customerEmail,
    subject: `Confirmation de votre message à ${shopName}`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #ff9900; padding-bottom: 15px;">
        <h2 style="color: #ff9900; font-size: 24px; margin: 0;">Message bien reçu!</h2>
        <p style="color: #666; font-size: 16px; margin-top: 5px;">Confirmation de votre contact avec <strong>${shopName}</strong></p>
      </div>
      
      <div style="padding: 15px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #333; line-height: 1.5;">
          Bonjour,
        </p>
        <p style="font-size: 16px; color: #333; line-height: 1.5;">
          Nous confirmons que votre message concernant <strong>"${subject}"</strong> a bien été transmis à <strong>${merchantFirstName}</strong> de la boutique <strong>${shopName}</strong>.
        </p>
        <p style="font-size: 16px; color: #333; line-height: 1.5;">
          Le commerçant a été notifié et vous répondra bientôt à cette adresse email.
        </p>
      </div>
      
      <div style="background-color: #fff5e6; padding: 15px; border-radius: 8px; margin-top: 25px;">
        <p style="color: #333; font-size: 14px; margin: 0;">
          <strong>Astuce:</strong> Consultez régulièrement votre boîte mail, le commerçant pourrait vous répondre à tout moment!
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <a 
          href="${boutiquesUrl}" 
          target="_blank" 
          style="
            background-color: #ff9900; 
            color: white; 
            padding: 12px 25px; 
            text-decoration: none; 
            border-radius: 5px; 
            font-weight: bold; 
            display: inline-block;
            cursor: pointer;
          "
        >
          Découvrir d'autres boutiques
        </a>
      </div>
      
      <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px;">
        <p>Ce message a été envoyé automatiquement depuis la plateforme Bibocom Market.</p>
        <p>© 2025 Bibocom Market - Tous droits réservés</p>
      </div>
    </div>
    `,
  };
 
  return transporter.sendMail(mailOptions);
 };


// Fonction pour envoyer une confirmation au client


// Fonction pour envoyer un email de bienvenue
export const sendWelcomeEmail = async (email, firstName) => {
  const mailOptions = {
    from: `"Votre Application" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Bienvenue sur notre plateforme!',
    html: `
     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f2f2f2; border-radius: 10px; background-color: #fff; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
    <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://via.placeholder.com/150" alt="Logo Bibocom_Market" style="max-width: 150px; margin-bottom: 15px;">
        <h2 style="color: #00aaff; font-size: 28px; font-weight: bold;">Bienvenue, ${firstName}!</h2>
    </div>
    <p style="font-size: 16px; color: #333;">Nous sommes ravis de vous accueillir sur notre plateforme <strong>Bibocom_Market</strong>.</p>
    <p style="font-size: 16px; color: #333;">Votre compte a été vérifié avec succès, et vous pouvez maintenant accéder à tous nos services.</p>
    <p style="font-size: 16px; color: #333;">N'hésitez pas à explorer toutes les fonctionnalités disponibles et à nous contacter si vous avez des questions.</p>
    <div style="text-align: center; margin-top: 30px; font-size: 16px; color: #555;">
        <p>Cordialement,<br><strong>L'équipe de Bibocom_Market</strong></p>
    </div>
    <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #aaa;">
        <p>Ce message a été envoyé automatiquement, veuillez ne pas répondre à cet e-mail.</p>
    </div>
</div>

    `,
  };

  return transporter.sendMail(mailOptions);
};

// Fonction pour envoyer un email de réinitialisation de mot de passe
export const sendPasswordResetEmail = async (email, resetCode) => {
  const mailOptions = {
    from: `"Votre Application" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Réinitialisation de votre mot de passe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333;">Réinitialisation de mot de passe</h2>
        <p>Vous avez demandé la réinitialisation de votre mot de passe. Veuillez utiliser le code suivant pour confirmer cette action:</p>
        <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
          <strong>${resetCode}</strong>
        </div>
        <p>Ce code est valide pendant 1 heure.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email et sécuriser votre compte.</p>
        <p>Cordialement,<br>L'équipe de Votre Application</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};