import { querys } from "@/src/app/lib/DbConnection";
import { verifyToken } from "@/src/app/lib/Token";
import { NextResponse } from "next/server";
 
export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        // Verify the token
        const auth = await verifyToken(req);
        if (!auth) {
            return NextResponse.json({ message: 'Unauthorized', status: 403 }, { status: 403 });
        }

        const data = await req.json();
        if (!data.id || !Array.isArray(data.id) || data.id.length === 0) {
            return NextResponse.json({ message: 'Invalid transaction IDs', status: 400 }, { status: 400 });
        }

        const { decoded } = auth;
        let marketerMobile = decoded.mobile;

        // If the user is an assistant, find the marketer
        if (decoded.role === 'assistant') {
            const [num] = await querys({
                query: `SELECT created_by FROM users WHERE user_id = ?`,
                values: [decoded.userId]
            });

            if (!num || !num.created_by) {
                return NextResponse.json({ message: 'User not found', status: 404 }, { status: 404 });
            }
            marketerMobile = num.created_by;
        }

        if (!marketerMobile) {
            return NextResponse.json({ message: 'Marketer mobile is missing', status: 400 }, { status: 400 });
        }

        // Get user_name and last invoice ID in one query
        const [userInfo, lastInvoice] = await Promise.all([
            querys({ query: `SELECT user_name FROM users WHERE user_mobile = ?`, values: [marketerMobile] }),
            querys({ query: `SELECT MAX(invoiceId) AS last_invoice_id FROM invoice WHERE created_by = ?`, values: [marketerMobile] })
        ]);

        if (!userInfo.length || !userInfo[0].user_name) {
            return NextResponse.json({ message: 'User not found', status: 404 }, { status: 404 });
        }

        const userName = userInfo[0].user_name;
        let invoiceNumber = 1;
        if (lastInvoice[0].last_invoice_id) {
            const lastInvoiceId = lastInvoice[0].last_invoice_id.split('-')[1];
            invoiceNumber = parseInt(lastInvoiceId, 10) + 1;
        }
        const paddedInvoiceId = invoiceNumber.toString().padStart(4, '0');
        const invoiceId = `${userName}-${paddedInvoiceId}`;

        // Insert invoice
        const result = await querys({
            query: `INSERT INTO invoice (invoiceId, transactionIds, created_by, farmer_mobile, magamai_show) VALUES (?, ?, ?, ?, ?)`,
            values: [invoiceId, JSON.stringify(data.id), marketerMobile, data.mobile, data.show]
        });

        if (result.affectedRows === 0) {
            return NextResponse.json({ message: 'Failed to add invoice', status: 400 }, { status: 400 });
        }

        // Update transactions in a batch
        await querys({
            query: `UPDATE transactions SET invoiceId = ? WHERE transaction_id IN (${data.id.map(() => '?').join(',')})`,
            values: [invoiceId, ...data.id]
        });

        return NextResponse.json({ message: 'Invoice added and transactions updated successfully', status: 200 }, { status: 200 });

    } catch (error) {
        console.error('Server Error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ message: 'Invoice ID already exists', status: 409 }, { status: 409 });
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
 
            const list = await querys({
                query: `SELECT i.invoiceId,i.created_by,i.created_at,MIN(f.farmer_name) AS farmer_name,tx.total_farmer_amount,tx.total_quantity
                FROM invoice i
                LEFT JOIN (SELECT invoiceId,SUM(farmer_amount) AS total_farmer_amount,SUM(quantity) AS total_quantity FROM transactions GROUP BY invoiceId) tx ON tx.invoiceId = i.invoiceId 
                LEFT JOIN farmers f ON f.farmer_mobile = i.farmer_mobile WHERE i.created_by = ?
                GROUP BY i.invoiceId, i.created_by, i.created_at, tx.total_farmer_amount, tx.total_quantity
                ORDER BY i.created_at DESC;
                    `,
                values: [marketerMobile]
            })
            return NextResponse.json({
                message: 'Data listed',
                data: list,
                status: 200
            }, { status: 200 });
 
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