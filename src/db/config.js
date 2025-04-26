import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: profile.emails[0].value }
      });

      if (existingUser) {
        // Si l'utilisateur existe, vérifier si les infos sont complètes
        if (!existingUser.phoneNumber || !existingUser.city || !existingUser.country) {
          return done(null, existingUser, { needsCompletion: true });
        }

        // Si tout est bon, on retourne l'utilisateur
        return done(null, existingUser);
      } else {
        // Si l'utilisateur n'existe pas, créer un compte partiel
        const newUser = await prisma.user.create({
          data: {
            email: profile.emails[0].value,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            photo: profile.photos[0].value,
            isVerified: false
          }
        });

        return done(null, newUser, { needsCompletion: true });
      }
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
