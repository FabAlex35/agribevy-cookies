import { NextResponse } from 'next/server';
import { querys } from '../../lib/DbConnection';

export const dynamic = "force-dynamic";
export async function GET() {
    // Fetch subscription list
    const getAll = await querys({
        query: 'SELECT * FROM subscription_list',
        values: []
    });

    if (getAll.length === 0) {
        return NextResponse.json({ message: "No subscriptions found" }, { status: 200 });
    }

    // Process each subscription
    for (const each of getAll) {
        let days = each.days - 1;
        const today = new Date();
        const currentDate = today.toISOString().split('T')[0];
        
        if (each.end_date < currentDate) {
            days = -1;
            await querys({
                query: "UPDATE subscription_list SET sub_id = ?, sub_status = ?, days = ?, is_show = ? WHERE user_id = ?",
                values: [!each.status, 0, days, 1, each.user_id]
            });
        } else {
            await querys({
                query: "UPDATE subscription_list SET sub_status = ?, days = ? WHERE user_id = ?",
                values: [1, days, each.user_id]
            });
        }
    }

    return NextResponse.json({ message: "Cron job executed successfully" }, { status: 200 });
}
