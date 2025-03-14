import { NextResponse } from 'next/server';
import cookie from 'cookie';
import { verifyToken } from '@/src/app/lib/Token';

export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        // Verify the token from the request (assuming token is in cookies)
        const auth = await verifyToken(req);
        
        // Create a JSON response for logout
        const response = NextResponse.json({
            message: 'Successfully logged out',
            status: 200
        });

        // Append Set-Cookie header to clear the 'accessToken' cookie
        response.headers.append('Set-Cookie', cookie.serialize('accessToken', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            expires: new Date(0),
            maxAge: 0 * 60,
            path: '/'
        }));

        response.headers.append('Set-Cookie', cookie.serialize('refreshToken', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            expires: new Date(0),
            maxAge: 0 * 60,
            path: '/'
        }));

        response.headers.append('Set-Cookie', cookie.serialize('role', '', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            expires: new Date(0),
            maxAge: 0 * 60,
            path: '/'
        }));

        // Return the response
        return response;
    } catch (error) {
        console.error('Error during logout:', error);
        // Return an error response
        return NextResponse.json({
            message: 'Failed to log out',
            status: 500
        }, { status: 500 });
    }
}
