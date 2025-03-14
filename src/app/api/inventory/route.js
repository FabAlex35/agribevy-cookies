import { querys } from "@/src/app/lib/DbConnection";
import { verifyToken } from "@/src/app/lib/Token";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        // Verify the token
        const auth = await verifyToken(req);
        const { decoded } = auth
        let mobile = decoded.mobile

        if (decoded.role == 'marketer' || decoded.role == 'assistant') {

            if (decoded.role == 'assistant') {
                const [num] = await querys({
                    query: `SELECT created_by FROM users WHERE user_id = ?`,
                    values: [decoded.userId]
                });

                if (!num) {
                    return NextResponse.json({
                        message: 'User not found',
                        status: 404
                    }, { status: 404 });
                }
                mobile = num?.created_by
            }

            // Fetch inventory data for the marketer
            const query = await querys({
                query: `SELECT p.vegetable_id, SUM(p.quantity_available) AS total_remaining, v.veg_name, l.tamil_name FROM products p LEFT JOIN vegetables v ON p.vegetable_id = v.veg_id LEFT JOIN veg_list l ON v.list_id = l.veg_id WHERE v.marketer_mobile = ? GROUP BY p.vegetable_id, v.veg_name, l.tamil_name HAVING total_remaining > 0;`,
                values: [mobile]
            });

            // Return the inventory data
            return NextResponse.json({
                message: 'Inventory list retrieved successfully',
                data: query,
                status: 200
            }, { status: 200 });
        } else {
            return NextResponse.json({
                message: 'Unauthorized',
                status: 403
            }, { status: 403 });
        }

    } catch (error) {
        console.error('Server Error:', error);
        return NextResponse.json({
            message: 'Server Error',
            status: 500
        }, { status: 500 });
    }
}