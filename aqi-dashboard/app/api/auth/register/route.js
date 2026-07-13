import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Vui lòng điền đầy đủ thông tin." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu ít nhất 6 ký tự." }, { status: 400 });
    }

    await connectToDatabase();

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "Email này đã được sử dụng." }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashed,
      provider: "credentials",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Register] Error:", e);
    return NextResponse.json({ error: "Lỗi máy chủ." }, { status: 500 });
  }
}
