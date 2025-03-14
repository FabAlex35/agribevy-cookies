import { querys } from "@/src/app/lib/DbConnection";
import { verifyToken } from "@/src/app/lib/Token";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Utility function for CORS headers
function setCORSHeaders(response) {
    response.headers.set("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    return response;
}

// Middleware to authenticate request
async function authenticateRequest(req) {
    try {
        const auth = await verifyToken(req);

        console.log("🔍 Auth result:", auth); // Debug log

        if (!auth || !auth.decoded) {
            console.error("❌ Authentication failed: Invalid token");
            return { error: NextResponse.json({ message: "Invalid token", status: 401 }, { status: 401 }) };
        }

        const { decoded } = auth;

        console.log("📜 Decoded token:", decoded); // Debug log

        if (!decoded.mobile) {
            console.error("⚠️ Decoded token missing 'mobile' field");
            return { error: NextResponse.json({ message: "Invalid token structure", status: 401 }, { status: 401 }) };
        }

        return { decoded };
    } catch (error) {
        console.error("🔥 Error in authenticateRequest:", error);
        return { error: NextResponse.json({ message: "Authentication error", status: 500 }, { status: 500 }) };
    }
}

// Handle CORS for preflight OPTIONS requests
export async function OPTIONS(req) {
    return setCORSHeaders(new NextResponse(null, { status: 204 }));
}

// GET Handler
export async function GET(req) {
    try {
        const response = new NextResponse();
        setCORSHeaders(response);

        const authResult = await authenticateRequest(req);
        if (authResult.error) return authResult.error;

        const { decoded } = authResult;
        console.log("🟢 Authenticated user in GET:", decoded); // Debug log

        if (!decoded.mobile) {
            console.error("❌ Mobile number missing in decoded token");
            return NextResponse.json({ message: "Invalid token format", status: 401 }, { status: 401 });
        }

        const url = new URL(req.url);
        const user = url.pathname.split('/').filter(Boolean).pop();
        let userMobile = decoded.mobile;

        if (decoded.role === "assistant") {
            const num = await querys({
                query: "SELECT created_by FROM users WHERE user_id = ?",
                values: [decoded.userId],
            });

            console.log("🔎 Assistant lookup result:", num); // Debug log

            if (!num.length || !num[0].created_by) {
                return NextResponse.json({ message: "User not found", status: 404 }, { status: 404 });
            }
            userMobile = num[0].created_by;
        }

        if (["marketer", "assistant"].includes(decoded.role)) {
            const transactions = await querys({
                query: `SELECT 
                    t.invoice_Id, SUM(t.quantity) AS quantity,
                    SUM(t.buyer_payment) AS buyer_payment,
                    SUM(t.buyer_amount) AS buyer_amount,
                    MAX(t.created_at) AS soldDate,
                    CASE WHEN SUM(CASE WHEN t.buyer_status = 'pending' THEN 1 ELSE 0 END) > 0 
                         THEN 'pending' ELSE 'paid' 
                    END AS buyer_status,
                    MAX(b.buyer_name) AS buyer_name,
                    MAX(b.buyer_mobile) AS buyer_mobile,
                    MAX(b.buyer_address) AS buyer_address
                FROM transactions t
                JOIN products p ON t.product_id = p.product_id
                LEFT JOIN buyers b ON t.buyer_mobile = b.buyer_mobile
                WHERE t.buyer_mobile = ? AND t.marketer_mobile = ?
                GROUP BY t.invoice_Id;`,
                values: [user, userMobile],
            });

            console.log("📊 Transactions fetched:", transactions); // Debug log

            if (transactions.length > 0) {
                return NextResponse.json({ message: "Buyer transaction listed", status: 200, data: transactions }, { status: 200 });
            } else {
                return NextResponse.json({ message: "No transactions found", status: 404 }, { status: 404 });
            }
        } else {
            return NextResponse.json({ message: "Unauthorized", status: 403 }, { status: 403 });
        }
    } catch (error) {
        console.error("🚨 Server Error:", error);
        return NextResponse.json({ message: "Server Error", status: 500 }, { status: 500 });
    }
}