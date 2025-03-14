import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import cookie from 'cookie';

const REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET_KEY;
const SECRET_KEY = process.env.JWT_SECRET_KEY;

export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const cookies = req.cookies;
        const refreshToken = cookies.get('refreshToken');

        if (!refreshToken) {
            return NextResponse.json({
                message: 'Refresh token not found',
                status: 400
            }, { status: 400 });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET_KEY);

        // Generate new access token
        const accessToken = jwt.sign(
            { userId: decoded.userId, mobile: decoded.mobile, role: decoded.role },
            SECRET_KEY,
            { expiresIn: '1d' }  
        );

        // Create a response with new access token
        const response = NextResponse.json({
            message: 'Token refreshed successfully',
            data: { accessToken },
            status: 200
        });

        // Set the new access token in a cookie
        response.headers.append('Set-Cookie', cookie.serialize('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60, // 1 day
            path: '/',
        }));

        return response;
    } catch (error) {
        return NextResponse.json({
            message: 'Invalid or expired refresh token',
            status: 401
        }, { status: 401 });
    }
}
