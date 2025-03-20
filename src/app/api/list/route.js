import { querys } from "@/src/app/lib/DbConnection";
import { verifyToken } from "@/src/app/lib/Token";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const auth = await verifyToken(req);
        if (!auth) {
            return NextResponse.json({ message: 'Unauthorized', status: 403 }, { status: 403 });
        }

        const ids = await req.json(); // List of vegetable IDs
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ message: 'Make sure to select at least one vegetable', status: 400 }, { status: 400 });
        }

        const { decoded } = auth;
        let mobile = decoded.mobile;

        // If user is an assistant, get the marketer's mobile number
        if (decoded.role === 'assistant') {
            const [num] = await querys({
                query: `SELECT created_by FROM users WHERE user_id = ?`,
                values: [decoded.userId]
            });

            if (!num) {
                return NextResponse.json({ message: 'User not found', status: 404 }, { status: 404 });
            }
            mobile = num.created_by;
        }

        // Check if marketer already has vegetables in the list
        const check = await querys({
            query: `SELECT list_id, status FROM vegetables WHERE marketer_mobile = ?`,
            values: [mobile]
        });

        const existingIds = new Set(check.map(item => item.list_id));
        const inactiveIds = check.filter(item => item.status === 0).map(item => item.list_id);

        const newIds = ids.filter(id => !existingIds.has(id)); // IDs that need to be inserted
        const reactivateIds = ids.filter(id => inactiveIds.includes(id)); // IDs that need to be reactivated
        const deselectedIds = check.map(item => item.list_id).filter(id => !ids.includes(id)); // IDs that need to be deactivated

        // **Batch Update - Deactivate deselected vegetables**
        if (deselectedIds.length > 0) {
            await querys({
                query: `UPDATE vegetables SET status = 0 WHERE list_id IN (?) AND marketer_mobile = ?`,
                values: [deselectedIds, mobile]
            });
        }

        // **Batch Update - Reactivate vegetables that were previously deactivated**
        if (reactivateIds.length > 0) {
            await querys({
                query: `UPDATE vegetables SET status = 1 WHERE list_id IN (?) AND marketer_mobile = ?`,
                values: [reactivateIds, mobile]
            });
        }

        // **Batch Insert - Add new vegetables**
        if (newIds.length > 0) {
            const vegDetails = await Promise.all(newIds.map(id =>
                querys({
                    query: `SELECT veg_name FROM veg_list WHERE veg_id = ?`,
                    values: [id]
                })
            ));

            const insertValues = newIds.map((id, index) => {
                const veg_name = vegDetails[index]?.[0]?.veg_name;
                const vegetable_id = `${veg_name}_${mobile}`;
                return [vegetable_id, veg_name, mobile, id, 1];
            });

            if (insertValues.length > 0) {
                await querys({
                    query: `INSERT INTO vegetables (veg_id, veg_name, marketer_mobile, list_id, status) VALUES ?`,
                    values: [insertValues]
                });
            }
        }

        return NextResponse.json({ message: 'Vegetables updated successfully', status: 200 }, { status: 200 });

    } catch (error) {
        console.error('Server Error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ message: 'Vegetable already exists', status: 409 }, { status: 409 });
        }

        return NextResponse.json({ message: 'Server Error', status: 500 }, { status: 500 });
    }
}

export async function GET(req) {
    try {
        // Verify the token
        const auth = await verifyToken(req);
        const { decoded } = auth;
        let marketerMobile = decoded.mobile;
        const role = decoded.role;

        if (role == 'marketer' || role == 'assistant') {
            if (role == 'assistant') {
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
                marketerMobile = num?.created_by;
            }

            // Fetch inventory data with tamil_name from the veg_list table
            const query = await querys({
                query: `
                    SELECT 
                        v.*,
                        vl.tamil_name
                    FROM 
                        vegetables v
                    LEFT JOIN 
                        veg_list vl
                    ON 
                        v.list_id = vl.veg_id
                    WHERE 
                        v.marketer_mobile = ? 
                        AND v.status = ?
                `,
                values: [marketerMobile, 1]
            });

            // Return the inventory data
            return NextResponse.json({
                message: 'Vegetable Listed successfully',
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
