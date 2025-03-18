import { jwtVerify, SignJWT } from 'jose';
import cookie from "cookie"; // ✅ Fix cookie parsing

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
const REFRESH_SECRET_KEY = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET_KEY);

// Convert string expiration times to valid formats (if needed)
const validUpto = process.env.JWT_EXPIRATION || "7d";  // ✅ Ensure proper format
const refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRATION || "30d";  // ✅ Ensure proper format

// Generate access token
export async function generateToken(user, subs, secretKey = SECRET_KEY, expirationTime = validUpto) {
    return await new SignJWT({
        userId: user.user_id ?? user.userId, // ✅ Cleaner syntax
        mobile: user.user_mobile ?? user.mobile,
        role: user.user_role ?? user.role,
        subscription: subs,
    })
        .setExpirationTime(expirationTime) // ✅ Ensures proper format
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .sign(secretKey);
}

// Generate refresh token
export async function generateRefreshToken(user, secretKey = REFRESH_SECRET_KEY, expirationTime = refreshTokenExpiry) {
    return await new SignJWT({
        userId: user.user_id ?? user.userId,
        mobile: user.user_mobile ?? user.mobile,
        role: user.user_role ?? user.role,
    })
        .setExpirationTime(expirationTime)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .sign(secretKey);
}

// Extract user role
export function showRole(user) {
    return user.user_role;
}

// Verify token (fixed for Next.js Middleware)
export async function verifyToken(req) {
    const cookies = cookie.parse(req.headers.get("cookie") || "");
    let token = cookies.accessToken;
    let flag = false;
      
    if (!token) {
        token = cookies.refreshToken;
        flag = true;
    }

    let key = flag ? REFRESH_SECRET_KEY : SECRET_KEY;
    
    try {
        // const decoded = decodeJwt(token);
        let decoded = await jwtVerify(token, key);
        return { decoded:decoded.payload, error: null }; 
    } catch (error) {
        let decoded = decodeJwt(token);
        if (error.code === "ERR_JWT_EXPIRED") {
            return { decoded:decoded, error: "Token expired" };
        }

        return { payload: null, error: "Invalid token", details: error.message };
    }
}