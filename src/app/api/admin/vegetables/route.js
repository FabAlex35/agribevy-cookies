import { querys } from "@/src/app/lib/DbConnection";
import { NextResponse } from "next/server";
import { verifyToken } from "@/src/app/lib/Token";

export const dynamic = "force-dynamic";

export async function GET(req) {  // for farmers
    try {
        const auth = await verifyToken(req)
 
        const { decoded } = auth
        const role = decoded.role        
 
        if (role == 'marketer'||role=="assistant") {
            const rows = await querys({
                query: `SELECT veg_name, veg_id ,path,tamil_name FROM veg_list WHERE status=1`,
                values: []
            });
 
            if (rows) {
                return NextResponse.json({
                    message: 'Vegetables Listed successfully',
                    data: rows,
                    status: 200
                }, { status: 200 });
            } else {
                return NextResponse.json({
                    message: 'No Data Found',
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
        console.log(error);
 
        return NextResponse.json({
            message: 'Server Error',
            status: 500
        }, { status: 500 });
    }
}