import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import cookie from "cookie"; // ✅ Correct way to handle cookies in Middleware
import { generateRefreshToken, generateToken } from "./app/lib/Token";

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
const REFRESH_SECRET_KEY = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET_KEY);
const validUpto = process.env.JWT_EXPIRATION;
const refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRATION;
const currentTime = Math.floor(Date.now() / 1000);

// Utility function to verify JWT
async function verifyToken(token, secretKey) {
    try {
        return (await jwtVerify(token, secretKey)).payload;
    } catch {
        return null;
    }
}

export async function middleware(req) {
    const url = req.nextUrl.clone();
    const cookies = cookie.parse(req.headers.get("cookie") || ""); // ✅ FIXED cookie handling
    const accessToken = cookies.accessToken || null;
    const refreshToken = cookies.refreshToken || null;

    // CORS Headers
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: response.headers });
    }

    const requiresAuth = url.pathname === "/" || url.pathname.startsWith("/portal") || url.pathname.startsWith("/api");

    if (!requiresAuth) {
        return response;
    }

    if (!accessToken && !refreshToken) {
        return url.pathname.startsWith("/portal") ? NextResponse.redirect(new URL("/", req.url)) : response;
    }

    let decodedAccess = accessToken ? await verifyToken(accessToken, SECRET_KEY) : null;
    let decodedRefresh = refreshToken ? await verifyToken(refreshToken, REFRESH_SECRET_KEY) : null;

    if (!decodedAccess && decodedRefresh?.exp > currentTime) {
        const newAccessToken = await generateToken(decodedRefresh, 0, SECRET_KEY, validUpto);
        const redirectResponse = NextResponse.redirect(new URL("/portal/dashboard", req.url));
        redirectResponse.headers.append("Set-Cookie", cookie.serialize("accessToken", newAccessToken, {
            httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "Strict", maxAge: 24 * 60 * 60, path: "/",
        }));
        return redirectResponse;
    }

    if (decodedAccess?.exp > currentTime && !decodedRefresh) {
        const newRefreshToken = await generateRefreshToken(decodedAccess, REFRESH_SECRET_KEY, refreshTokenExpiry);
        const redirectResponse = NextResponse.redirect(new URL("/portal/dashboard", req.url));
        redirectResponse.headers.append("Set-Cookie", cookie.serialize("refreshToken", newRefreshToken, {
            httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "Strict", maxAge: 24 * 60 * 60, path: "/",
        }));
        return redirectResponse;
    }

    if (decodedAccess && decodedRefresh && url.pathname === "/") {
        return NextResponse.redirect(new URL("/portal/dashboard", req.url));
    }

    if (!decodedAccess && !decodedRefresh) {
        const redirectResponse = NextResponse.redirect(new URL("/", req.url));
        ["accessToken", "refreshToken", "role"].forEach((name) => {
            redirectResponse.headers.append("Set-Cookie", cookie.serialize(name, "", {
                httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "Strict", maxAge: 0, path: "/",
            }));
        });
        return redirectResponse;
    }

    return response;
}

// Apply middleware to API routes and portal pages
export const config = {
    matcher: ["/api/:path*", "/portal/:path*"],
};