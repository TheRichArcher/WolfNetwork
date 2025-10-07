import NextAuth from "next-auth";
import Auth0 from "next-auth/providers/auth0";

const invitedEmails: string[] = (process.env.INVITED_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Auth0({
      issuer: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}` : undefined,
      clientId: process.env.AUTH0_CLIENT_ID!,
      clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (process.env.NODE_ENV !== "production") return true;
      if (invitedEmails.length === 0) return false;
      const email = (user?.email || "").toLowerCase();
      return invitedEmails.includes(email);
    },
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});


