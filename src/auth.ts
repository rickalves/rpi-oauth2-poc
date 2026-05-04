import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb";

const testProvider =
  process.env.ENABLE_TEST_CREDENTIALS === "true"
    ? [
        Credentials({
          id: "test-credentials",
          name: "Test Credentials",
          credentials: {
            email: { label: "Email", type: "text" },
          },
          authorize(credentials) {
            if (credentials?.email === "test@example.com") {
              return {
                id: "test-user-id-000000000001",
                name: "Test User",
                email: "test@example.com",
                image: "https://avatars.githubusercontent.com/u/0",
              };
            }
            return null;
          },
        }),
      ]
    : [];

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    ...testProvider,
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },
});
