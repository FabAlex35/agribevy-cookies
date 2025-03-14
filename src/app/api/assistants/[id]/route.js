import { querys } from "@/src/app/lib/DbConnection";
import { verifyToken } from "@/src/app/lib/Token";
import { NextResponse } from "next/server";  

export const dynamic = "force-dynamic";

export async function PUT(req) {
    try {
        // Verify the token
        const auth = await verifyToken(req);
        const { decoded } = auth

        const user = await req.json()

        // Extract phone number from the URL path
        const { pathname } = new URL(req.url);
        const segments = pathname.split('/').filter(segment => segment);
        const id = segments.pop();

        if (decoded.role == 'marketer') {
            // Fetch user data from the database
            const rows = await querys({
                query: `UPDATE users SET user_name = ?, user_mobile = ?, access = ? WHERE user_id = ?`,
                values: [user.name, user.mobile, user.access, id]
            });

            // Check if any rows were returned
            if (rows.affectedRows > 0) {
                return NextResponse.json({
                    message: 'Assistants Updated successfully',
                    status: 200
                }, { status: 200 });
            } else {
                return NextResponse.json({
                    message: 'Assistants not found',
                    status: 404
                }, { status: 404 });
            }
        } else {
            return NextResponse.json({
                message: 'Unauthorized',
                status: 403
            }, { status: 403 });
        }

    } catch (error) {
        console.error('Server Error:', error);
        if (error.code == 'ER_DUP_ENTRY') {
            return NextResponse.json({
                message: 'Mobile Number already exists',
                status: 409
            }, { status: 409 });
        }

        return NextResponse.json({
            message: 'Server Error',
            status: 500
        }, { status: 500 });
    }
}


export async function DELETE(req) {
    try {
        // Verify the token
        const auth = await verifyToken(req);
        const { decoded } = auth

        // Extract phone number from the URL path
        const { pathname } = new URL(req.url);
        const segments = pathname.split('/').filter(segment => segment);
        const id = segments.pop();

        if (decoded.role == 'marketer') {
            // Fetch user data from the database
            const rows = await querys({
                query: `DELETE FROM users WHERE user_id = ?`,
                values: [id]
            });

            // Check if any rows were returned
            if (rows.affectedRows > 0) {
                return NextResponse.json({
                    message: 'Assistants Removed successfully',
                    status: 200
                }, { status: 200 });
            } else {
                return NextResponse.json({
                    message: 'Assistants not found',
                    status: 404
                }, { status: 404 });
            }
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