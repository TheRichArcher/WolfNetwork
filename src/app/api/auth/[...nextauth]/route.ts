import NextAuth from "next-auth";
import Auth0Provider from "next-auth/providers/auth0";
import Airtable from 'airtable';
import { getEnv } from '@/lib/env';

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
      const email = (user?.email || "").toLowerCase();
      // Allow all in non-production
      if (process.env.NODE_ENV !== "production") return true;

      // First, allow if in explicit invited list
      if (invitedEmails.length > 0 && invitedEmails.includes(email)) return true;

      // Otherwise, allow if Airtable marks user as approved
      try {
        const env = getEnv();
        if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) return false;
        const base = new Airtable({ apiKey: env.AIRTABLE_API_KEY }).base(env.AIRTABLE_BASE_ID);
        const users = base(process.env.USERS_TABLE_NAME || 'users');
        const records = await users.select({ filterByFormula: `OR({email} = '${email}', {Email} = '${email}')`, maxRecords: 1 }).firstPage();
        if (records.length === 0) return false;
        const r = records[0];
        const status = (r.get('status') as string) || (r.get('Status') as string) || '';
        const approved = /approved|active/i.test(status);
        return approved;
      } catch {
        return false;
      }
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


