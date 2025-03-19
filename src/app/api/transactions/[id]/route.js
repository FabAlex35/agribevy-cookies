import { querys } from "@/src/app/lib/DbConnection";
import { verifyToken } from "@/src/app/lib/Token";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        const auth = await verifyToken(req)

        const { pathname } = new URL(req.url)
        const segments = pathname.split('/').filter(segment => segment);
        const id = segments.pop();

        const rows = await querys({
            query: `SELECT * FROM transactions WHERE product_id = ?`,
            values: [id]
        });

        const rows1 = await querys({
            query: ` SELECT p.proposed_price, p.quantity, p.created_at, v.veg_name, u.user_name FROM products p 
                    JOIN vegetables v ON p.vegetable_id = v.veg_id JOIN users u ON v.marketer_mobile = u.user_mobile
                    WHERE p.product_id = ?`,
            values: [id]
        });

        if (rows && rows1) {
            return NextResponse.json({
                message: 'Transaction Listed successfully',
                data: {
                    detail: rows1,
                    transaction: rows
                },
                status: 200
            }, { status: 200 });
        } else {
            return NextResponse.json({
                message: 'No Data Found',
                status: 404
            }, { status: 404 });
        }


    } catch (error) {
        console.log(error);

        return NextResponse.json({
            message: 'Server Error',
            status: 500
        }, { status: 500 });
    }
}



export async function PUT(req) {
    try {
        const auth = await verifyToken(req);

        const { pathname } = new URL(req.url);
        const segments = pathname.split('/').filter(segment => segment);
        const type = segments.pop();

        const data = await req.json();
        const paymentAmount = parseInt(data.payment, 10);
        const ids = data.id;
        const user = data.role;
        const phone = data.phone;
        const userName = data.name;

        const { decoded } = auth;
        const role = decoded.role;
        let marketerMobile = decoded.mobile;

        if (!role || (role !== 'marketer' && role !== 'assistant')) {
            return NextResponse.json({ message: 'Unauthorized', status: 403 }, { status: 403 });
        }

        if (role === 'assistant') {
            const [num] = await querys({
                query: `SELECT created_by FROM users WHERE user_id = ?`,
                values: [decoded.userId]
            });

            if (!num) {
                return NextResponse.json({ message: 'User not found', status: 404 }, { status: 404 });
            }

            marketerMobile = num?.created_by;
        }

        // Insert payment record
        const insertResult = await querys({
            query: `INSERT INTO accounts (amount, marketer_mobile, mobile, user) VALUES (?, ?, ?, ?)`,
            values: [paymentAmount, marketerMobile, phone, userName]
        });

        if (insertResult.affectedRows <= 0) {
            return NextResponse.json({ message: 'Failed to insert payment record.', status: 500 }, { status: 500 });
        }

        let totalPaid = paymentAmount;
        let updateQueries = [];

        if (user === 'buyer') {
            // Get all transactions in one query to reduce database calls
            const transactions = await querys({
                query: `SELECT transaction_id, buyer_payment FROM transactions WHERE transaction_id IN (?)`,
                values: [ids]
            });

            for (const transaction of transactions) {
                if (totalPaid <= 0) break;
                const { transaction_id, buyer_payment } = transaction;

                let newPayment = Math.max(0, buyer_payment - totalPaid);
                let newStatus = newPayment === 0 ? "paid" : "pending";
                totalPaid -= buyer_payment;

                updateQueries.push(
                    querys({
                        query: `UPDATE transactions SET buyer_payment = ?, buyer_status = ? WHERE transaction_id = ?`,
                        values: [newPayment, newStatus, transaction_id]
                    })
                );
            }
        } else {
            // Farmer Payments
            if (type === 'single') {
                updateQueries.push(
                    querys({
                        query: `UPDATE transactions SET farmer_payment = GREATEST(0, farmer_payment - ?), 
                                farmer_status = CASE WHEN (farmer_payment - ?) <= 0 THEN 'paid' ELSE 'pending' END 
                                WHERE transaction_id = ?`,
                        values: [paymentAmount, paymentAmount, ids]
                    })
                );
            } else {
                // Get all transactions in one query
                const transactions = await querys({
                    query: `SELECT transaction_id, farmer_payment FROM transactions WHERE transaction_id IN (?)`,
                    values: [ids]
                });

                for (const transaction of transactions) {
                    if (totalPaid <= 0) break;
                    const { transaction_id, farmer_payment } = transaction;

                    let newPayment = Math.max(0, farmer_payment - totalPaid);
                    let newStatus = newPayment === 0 ? "paid" : "pending";
                    totalPaid -= farmer_payment;

                    updateQueries.push(
                        querys({
                            query: `UPDATE transactions SET farmer_payment = ?, farmer_status = ? WHERE transaction_id = ?`,
                            values: [newPayment, newStatus, transaction_id]
                        })
                    );
                }
            }
        }

        // Execute all updates in parallel
        await Promise.all(updateQueries);

        return NextResponse.json({ message: 'Transaction(s) updated successfully', status: 200 });

    } catch (error) {
        console.error('PUT API Error:', error);
        return NextResponse.json({ message: 'Server Error', status: 500 }, { status: 500 });
    }
}
