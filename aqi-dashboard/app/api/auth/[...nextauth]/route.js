import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        await connectToDatabase();
        // Tự tạo user trong MongoDB nếu chưa có (auto-register)
        const existingUser = await User.findOne({ email: user.email });
        if (!existingUser) {
          await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
          });
          console.log(`[Auth] New user registered: ${user.email}`);
        }
        return true;
      } catch (error) {
        console.error("[Auth] Error during sign in:", error);
        return true; // Vẫn cho đăng nhập dù lưu DB lỗi
      }
    },
    async session({ session, token }) {
      // Gắn thêm user info từ MongoDB vào session
      try {
        await connectToDatabase();
        const dbUser = await User.findOne({ email: session.user.email }).lean();
        if (dbUser) {
          session.user.id = dbUser._id.toString();
          session.user.alertEnabled = dbUser.alertEnabled;
          session.user.aqiThreshold = dbUser.aqiThreshold;
        }
      } catch (error) {
        console.error("[Auth] Error fetching session user:", error);
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
