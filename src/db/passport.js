import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:8001/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google profile:', profile);
        
        // Vérifier si l'utilisateur existe déjà dans la base de données
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });
        
        // Si aucun utilisateur n'est trouvé par googleId, vérifier par email
        if (!user && profile.emails && profile.emails.length > 0) {
          user = await prisma.user.findUnique({
            where: { email: profile.emails[0].value },
          });
          
          // Si un utilisateur est trouvé par email, mettre à jour son googleId
          if (user) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId: profile.id },
            });
            console.log(`Utilisateur existant avec email ${user.email} mis à jour avec googleId: ${profile.id}`);
          }
        }
        
        if (!user) {
          // Extraire les informations du profil Google
          const firstName = profile.name.givenName || profile.displayName.split(' ')[0];
          const lastName = profile.name.familyName ||
                          (profile.displayName.split(' ').length > 1
                          ? profile.displayName.split(' ').slice(1).join(' ')
                          : '');
          
          console.log(`Création d'un nouvel utilisateur: ${firstName} ${lastName}`);
          
          // Créer un nouvel utilisateur avec un phoneNumber temporaire unique pour éviter les violations de contrainte
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              email: profile.emails[0].value,
              firstName,
              lastName,
              phoneNumber: `temp-${profile.id}-${Date.now()}`, // Valeur temporaire unique
              password: '', // Sera remplacé plus tard
              country: '',
              city: '',
              department: '',
              commune: '',
              role: 'CLIENT', // Rôle par défaut
              photo: profile.photos?.[0]?.value || null,
              isVerified: true, // Déjà vérifié par Google
              isProfileCompleted: false,
            },
          });
          
          console.log(`Nouvel utilisateur créé avec l'ID: ${user.id}`);
          return done(null, user, { needsCompletion: true });
        }
        
        // Vérifier si le profil est incomplet
        const needsCompletion =
          !user.phoneNumber || 
          user.phoneNumber.startsWith('temp-') || // Considérer les numéros temporaires comme incomplets
          !user.password ||
          !user.country ||
          !user.city ||
          !user.department ||
          !user.commune;
        
        console.log(`Utilisateur existant (ID: ${user.id}), needsCompletion: ${needsCompletion}`);
        
        if (needsCompletion) {
          return done(null, user, { needsCompletion: true });
        }
        
        return done(null, user);
      } catch (error) {
        console.error('Erreur d\'authentification Google:', error);
        return done(error, null);
      }
    }
  )
);

// Sérialisation/désérialisation (nécessaire même si on utilise JWT)
passport.serializeUser((user, done) => {
  console.log(`Sérialisation de l'utilisateur: ${user.id}`);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    console.log(`Désérialisation de l'utilisateur: ${id}`);
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    console.error('Erreur lors de la désérialisation:', error);
    done(error, null);
  }
});

export default passport;