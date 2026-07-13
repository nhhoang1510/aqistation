import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

const handler = NextAuth({
  providers: [
    // ── Google OAuth ──
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    // ── Email + Password ──
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          await connectToDatabase();
          const user = await User.findOne({ email: credentials.email.toLowerCase() });
          if (!user || !user.password) return null;
          const valid = await bcrypt.compare(credentials.password, user.password);
          if (!valid) return null;
          return { id: user._id.toString(), name: user.name, email: user.email, image: user.image };
        } catch (e) {
          console.error("[Auth] Credentials error:", e);
          return null;
        }
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: { strategy: "jwt" },

  pages: {
    signIn: "/",   // không dùng trang login riêng
  },

  callbacks: {
    async signIn({ user, account }) {
      // Google: tự tạo/cập nhật user
      if (account?.provider === "google") {
        try {
          await connectToDatabase();
          const existing = await User.findOne({ email: user.email });
          if (!existing) {
            await User.create({ name: user.name, email: user.email, image: user.image, provider: "google" });
          }
        } catch (e) {
          console.error("[Auth] Google signIn error:", e);
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },

    async session({ session, token }) {
      if (token?.id) session.user.id = token.id;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
