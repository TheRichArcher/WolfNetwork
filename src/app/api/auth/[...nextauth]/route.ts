import NextAuth from "next-auth";
import Auth0Provider from "next-auth/providers/auth0";

const invitedEmails: string[] = (process.env.INVITED_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const handler = NextAuth({
  providers: [
    Auth0Provider({
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
    async session({ session }) {
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };


