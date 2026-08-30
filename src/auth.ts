import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { normalizeEmail, verifyPassword } from "@/lib/password";

const providers: NextAuthConfig["providers"] = [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID!,
    clientSecret: process.env.AUTH_GOOGLE_SECRET!,
  }),
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = normalizeEmail(String(credentials?.email ?? ""));
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        isPremium: user.isPremium,
        canEditContent: user.canEditContent,
      };
    },
  }),
];

if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  providers.unshift(
    Facebook({
      clientId: process.env.AUTH_FACEBOOK_ID,
      clientSecret: process.env.AUTH_FACEBOOK_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  providers,
  pages: {
    signIn: "/",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub } });
        if (dbUser) {
          token.isPremium = dbUser.isPremium;
          token.canEditContent = dbUser.canEditContent;
          token.email = dbUser.email;
        } else if (typeof token.email === "string" && token.email) {
          const byEmail = await prisma.user.findUnique({
            where: { email: normalizeEmail(token.email) },
          });
          if (byEmail) {
            token.sub = byEmail.id;
            token.isPremium = byEmail.isPremium;
            token.canEditContent = byEmail.canEditContent;
            token.email = byEmail.email;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.isPremium = Boolean(token.isPremium);
        session.user.canEditContent = Boolean(token.canEditContent);
        if (token.email && typeof token.email === "string") {
          session.user.email = token.email;
        }
      }
      return session;
    },
  },
});

export function isFacebookAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
}
