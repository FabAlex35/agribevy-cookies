import { querys } from "@/src/app/lib/DbConnection";
import { verifyToken } from "@/src/app/lib/Token";
import { NextResponse } from "next/server";
 
export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const auth = await verifyToken(req);
     
        const exp = await req.json();
        const { decoded } = auth;
        let userMobile = decoded.mobile;
 
        if (decoded.role === 'marketer' || decoded.role === 'assistant') {
            if (decoded.role === 'assistant') {
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
 
                userMobile = num?.created_by;
            }
            
            let sum = exp.rent + exp.wage + exp.expenditure + exp.fuel + exp.electricity + exp.water + exp.mobile + exp.travel + exp.miscellneous
            
            const result = await querys({
                query: `INSERT INTO balance_sheet (rent, emp_wage, daily_expenditure, fuel, electricity, water,
                mobile_bill, travel, miscellaneous, expenditure_date, created_by, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                values: [exp.rent, exp.wage, exp.expenditure, exp.fuel, exp.electricity, exp.water, exp.mobile, exp.travel,
                exp.miscellneous, exp.date, userMobile, sum]
            });
 
            // Check if the insert was successful
            if (result.affectedRows > 0) {
                return NextResponse.json({
                    message: 'Data added successfully',
                    status: 200
                }, { status: 200 });
            } else {
                return NextResponse.json({
                    message: 'Data not added',
                    status: 400
                }, { status: 400 });
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


export async function GET(req) {
    try {
        const auth = await verifyToken(req);
 
        const { decoded } = auth;
        let userMobile = decoded.mobile;
 
        if (decoded.role === 'marketer' || decoded.role === 'assistant') {
            if (decoded.role === 'assistant') {
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
 
                userMobile = num?.created_by;
            }
 
            const [ {financialYear} ] = await querys({
                query: `SELECT financialYear FROM default_setting WHERE marketer_mobile = ?`,
                values: [userMobile]
            });

            let yearStart = financialYear  ? financialYear : 1
                
            const query = `
            SELECT user_id, created_at,
                CASE
                    WHEN YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) THEN 0
                    ELSE TIMESTAMPDIFF(MONTH, created_at, NOW()) + 1
                END AS months_since_creation,
                MONTH(created_at) AS month
            FROM users
            WHERE user_mobile = ?`;
 
            const result = await querys({ query, values: [userMobile] });
            const { created_at, months_since_creation, month } = result[0];
 
            const createdAt = new Date(created_at);
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;
 
            const buildYearsResponse = (startYear, createdYear, months_since_creation) => {
                const yearsResponse = [];
                let count = Math.min(3, currentYear - createdYear);
 
                if (startYear === 4) {
                    let year = currentYear;
                    while (count-- > 0) {
                        yearsResponse.push({
                            value: `${year}-${year - 1}`,
                            label: `${year}-${year - 1}`
                        });
                        year--;
                    }
                } else {
                    let year = currentYear - count;
                    while (count-- > 0) {
                        yearsResponse.push({
                            value: `${year}`,
                            label: `${year}`
                        });
                        year--;
                    }
                }
                return yearsResponse;
            };            
 
            const isFinancialYearCurrent = currentMonth >= yearStart;
            const yearsResponse = buildYearsResponse(yearStart, createdAt.getFullYear(), months_since_creation);        
 
            const transactionPeriods = ['thisMonth'];
 
            if (months_since_creation > 24) {
                transactionPeriods.push('lastMonth', 'thisQuarter', 'lastQuarter', 'thisYear', 'lastYear');
            } else if (months_since_creation >= 12) {
                transactionPeriods.push('lastMonth', 'thisQuarter', 'lastQuarter');
                if (month === yearStart || month > yearStart) {
                    transactionPeriods.push('thisYear');
                } else {
                    transactionPeriods.push('thisYear', 'lastYear');
                }
            } else if (months_since_creation >= 3) {               
                transactionPeriods.push('lastMonth', 'thisQuarter');
                if (month === yearStart || month > yearStart) {
                    transactionPeriods.push('lastQuarter','thisYear');
                } else {
                    transactionPeriods.push('thisYear', 'lastYear');
                }
            } else if (months_since_creation >= 2) {
                transactionPeriods.push('lastMonth', 'thisQuarter');
                if (month === yearStart || month > yearStart) {
                    transactionPeriods.push('thisYear');
                } else {
                    transactionPeriods.push('lastQuarter', 'thisYear', 'lastYear');
                }
            } else if (months_since_creation === 1) {
                transactionPeriods.push('lastMonth');
                if (month === yearStart || month > yearStart) {
                    transactionPeriods.push('thisQuarter', 'thisYear');
                } else {
                    transactionPeriods.push('thisQuarter', 'lastQuarter', 'thisYear', 'lastYear');
                }
            }
            const uniqueTransactionPeriods = [...new Set(transactionPeriods)];
 
            const formatResponse = (items) => items.map(item => ({
                value: item,
                label: item.charAt(0).toUpperCase() + item.slice(1).replace(/([A-Z])/g, ' $1').trim()
            }));
 
            const response = [
                ...formatResponse(uniqueTransactionPeriods),
                ...yearsResponse
            ];
 
            return NextResponse.json({
                message: 'Success',
                data: response,
                status: 200
            }, { status: 200 });
 
        } else {
            return NextResponse.json({
                message: 'Unauthorized',
                status: 403
            }, { status: 403 });
        }
 
    } catch (error) {
        return NextResponse.json({
            message: 'Server Error',
            status: 500
        }, { status: 500 });
    }
}
