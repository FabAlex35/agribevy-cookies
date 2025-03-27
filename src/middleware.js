import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import cookie from "cookie";

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
const REFRESH_SECRET_KEY = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET_KEY);

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
    const cookies = cookie.parse(req.headers.get("cookie") || "");
    const accessToken = cookies.accessToken || null;
    const refreshToken = cookies.refreshToken || null;
    const currentTime = Math.floor(Date.now() / 1000);

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

    if(url.pathname.startsWith("/api/trigger-cron")){
        return response
    }

    if (!requiresAuth) {
        return response;
    }    

    if (!accessToken && !refreshToken) {
        return url.pathname.startsWith("/portal") ? NextResponse.redirect(new URL("/", req.url)) : response;
    }

    let decodedAccess = accessToken ? await verifyToken(accessToken, SECRET_KEY) : null;
    let decodedRefresh = refreshToken ? await verifyToken(refreshToken, REFRESH_SECRET_KEY) : null;
    
    if(!decodedAccess && !decodedRefresh){
         if(url.pathname.startsWith("/portal")){
            // return NextResponse.redirect(new URL("/", req.url));
             const response = NextResponse.redirect(new URL("/", req.url))
            
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
         }
    }

    if(!decodedAccess){
        if(!decodedRefresh){
            if (req.method != "GET" && url.pathname.startsWith("/api") && url.pathname != "/api/auth/logout") {
                return NextResponse.json({ message: "Session Expired" }, { status: 401 });
            }
        }else{
            if (req.method != "GET" && url.pathname != "/api/auth/refresh") {
                return NextResponse.json({ message: "Refersh" }, { status: 401 });
            }else if(url.pathname == "/"){
                return NextResponse.redirect(new URL("/portal/dashboard", req.url))
            }
        }
    }
    
    if(decodedAccess && decodedAccess.exp > currentTime || decodedRefresh && decodedRefresh.exp > currentTime){
        return url.pathname == ("/") ? NextResponse.redirect(new URL("/portal/dashboard", req.url)) : response;
    }

    return response;
}

// Apply middleware to API routes and portal pages
export const config = {
    matcher: ["/api/:path*", "/portal/:path*", "/"],
};