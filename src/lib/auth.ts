import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { Session } from "next-auth";

// Extend the session types to include the user id
interface ExtendedSession extends Session {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id?: string;
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  callbacks: {
    async session({ session, token }) {
      // Add user info to the session
      const extendedSession = session as ExtendedSession;
      if (extendedSession.user && token.sub) {
        extendedSession.user.id = token.sub;
      }
      return extendedSession;
    },
    async jwt({ token, user }) {
      // Add user info to the token
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async signIn({
      user,
    }: {
      user: { email?: string; name?: string; id?: string; image?: string };
    }) {
      if (!user.email) return false;

      try {
        // Log the sign-in for monitoring
        console.log(`User ${user.email} signed in successfully with NextAuth`);

        // Don't try to create Supabase user here since this runs on the server side
        // and we need client components to work with Supabase auth
        // We'll handle this in a client component after the user is redirected

        return true;
      } catch (error) {
        console.error("Error during sign-in:", error);
        // Still allow sign-in even if there's an error
        return true;
      }
    },
  },
};
