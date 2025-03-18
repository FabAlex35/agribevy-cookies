import { querys } from "@/src/app/lib/DbConnection";
import { generateToken, showRole, generateRefreshToken } from "@/src/app/lib/Token";
import bcrypt from 'bcrypt';
import cookie from 'cookie';
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const { mobile, password } = await req.json();

        if (!mobile || !password) {
            return NextResponse.json({ message: 'Missing mobile number or password', status: 400 }, { status: 400 });
        }

        const rows = await querys({
            query: 'SELECT * FROM users WHERE user_mobile = ?',
            values: [mobile]
        });

        if (!rows.length) {
            return NextResponse.json({ message: 'No user found with this mobile number', status: 404 }, { status: 404 });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.user_pwd);

        if (!match) {
            return NextResponse.json({ message: 'Incorrect password', status: 400 }, { status: 400 });
        }

        let subs = { id: null, status: 0 };
        let isSetting = false;
        const role = showRole(user);
        let marketerMobile = mobile;

        if (role === "marketer" || role === "assistant") {
            if (role === 'assistant') {
                const num = await querys({
                    query: "SELECT created_by FROM users WHERE user_mobile = ?",
                    values: [mobile]
                });

                if (!num.length) {
                    return NextResponse.json({ message: 'User not found', status: 404 }, { status: 404 });
                }

                marketerMobile = num[0]?.created_by;
            }

            const settings = await querys({
                query: 'SELECT * FROM default_setting WHERE marketer_mobile = ?',
                values: [marketerMobile]
            });

            isSetting = settings.length > 0;

            const userData = await querys({
                query: 'SELECT user_id FROM users WHERE user_mobile = ?',
                values: [marketerMobile]
            });

            if (userData.length) {
                const sub = await querys({
                    query: 'SELECT * FROM subscription_list WHERE user_id = ?',
                    values: [userData[0].user_id]
                });

                if (sub.length > 0) {
                    subs = { id: sub[0]?.user_id, status: sub[0]?.sub_status };
                }
            }
        }

        const token = await generateToken(user, subs);
        const refreshToken = await generateRefreshToken(user);

        const response = NextResponse.json({
            message: 'Successfully logged in',
            data: { user_id: user.user_id, user_mobile: user.user_mobile, isSetting, role },
            status: 200
        });

        response.headers.append('Set-Cookie', cookie.serialize('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 30 * 24 * 60 * 60,
            path: '/',
        }));

        response.headers.append('Set-Cookie', cookie.serialize('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        }));

        response.headers.append('Set-Cookie', cookie.serialize('role', role, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 30 * 24 * 60 * 60,
            path: '/',
        }));

        return response;
    } catch (error) {
        console.error("Error in login:", error);
        return NextResponse.json({ message: 'Server Error', status: 500 }, { status: 500 });
    }
}