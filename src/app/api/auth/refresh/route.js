import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import cookie from 'cookie';
import { querys } from '@/src/app/lib/DbConnection';
import { generateRefreshToken, generateToken } from '@/src/app/lib/Token';

const REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET_KEY;

export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        // ✅ Parse cookies from request headers
        const cookies = cookie.parse(req.headers.get("cookie") || "");
        const refreshToken = cookies.refreshToken;

        if (!refreshToken) {
            return NextResponse.json({ message: "No refresh token provided", status: 401 }, { status: 401 });
        }

        // ✅ Verify refresh token
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET_KEY);
        let subs = { id: null, status: 0 };
        let marketerMobile = decoded.mobile;

        if (decoded.role === "assistant") {
            const num = await querys({
                query: "SELECT created_by FROM users WHERE user_mobile = ?",
                values: [decoded.mobile]
            });

            if (!num.length) {
                return NextResponse.json({ message: "User not found", status: 404 }, { status: 404 });
            }

            marketerMobile = num[0]?.created_by;
        }

        // ✅ Get user data
        const userData = await querys({
            query: "SELECT user_id FROM users WHERE user_mobile = ?",
            values: [marketerMobile]
        });

        if (!userData.length) {
            return NextResponse.json({ message: "User not found", status: 404 }, { status: 404 });
        }

        // ✅ Get subscription status
        const sub = await querys({
            query: "SELECT * FROM subscription_list WHERE user_id = ?",
            values: [userData[0].user_id]
        });

        if (sub.length > 0) {
            subs = { id: sub[0]?.user_id, status: sub[0]?.sub_status };
        }

        // ✅ Generate new tokens
        const user = {
            userId: decoded.userId,
            mobile: decoded.mobile,
            role: decoded.role
        };

        const access = await generateToken(user, subs);
        const refresh = await generateRefreshToken(user);

        // ✅ Create response
        const response = NextResponse.json({
            message: "Successfully refreshed tokens",
            data: {access},
            status: 200
        });

        // ✅ Set new refresh token in cookies
        response.headers.append("Set-Cookie", cookie.serialize("refreshToken", refresh, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            maxAge: 30 * 24 * 60 * 60, // 30 days
            path: "/"
        }));

        // ✅ Set new access token in cookies
        response.headers.append("Set-Cookie", cookie.serialize("accessToken", access, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            maxAge: 24 * 60 * 60, // 24 hours
            path: "/"
        }));

        return response;
    } catch (error) {
        console.error("Refresh token error:", error);

        return NextResponse.json({
            message: "Invalid or expired refresh token",
            status: 401
        }, { status: 401 });
    }
}
