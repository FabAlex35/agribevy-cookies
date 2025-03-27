import { querys } from "@/src/app/lib/DbConnection";
import { verifyToken } from "@/src/app/lib/Token";
import { NextResponse } from "next/server";
import cloudinary from "@/src/app/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function POST(req) {
    
    try {
        const auth = await verifyToken(req)
        const data = await req.formData()
        
        const logo = data.get('file')
        const commission = parseFloat(data.get('commission'))
        const magamai = parseFloat(data.get('magamai'))
        const weekoff = data.get('weekoff')
        const magamaiSource = data.get('magamaiSource')
        const language = data.get('language')
        const app_language = data.get('app_language')
        const magamaiType = data.get('magamaiType')
        const year = parseInt(data.get('financialYear'))
        const billMode = data.get('bill_type')
        const magamai_show = parseInt(data.get("magamai_show"))
        
        const initialVisibleColumns = [
            'Product', 'Farmer', 'Buyer', 'Farmer Bill', 'Sold at', 'Buyer Amount'
        ];
        if (!logo) {
            return NextResponse.json({
                status: 400,
                message: 'No file uploaded'
            }, { status: 400 });
        }

        const mimeType = logo.type;
        const validMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];

        if (!validMimeTypes.includes(mimeType)) {
            return NextResponse.json({
                success: false,
                message: 'Invalid file type. Only JPEG, PNG, and JPG are allowed.'
            }, { status: 400 });
        }

        const bytes = await logo.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadResponse = await cloudinary.uploader.upload(`data:${mimeType};base64,${buffer.toString('base64')}`, {
            folder: 'uploads/logo',
            resource_type: 'image',
        });

        const imagePath = uploadResponse.secure_url;

        const { decoded } = auth
        const marketerMobile = decoded.mobile
        const role = decoded.role

        if (role == 'marketer') {

            // Insert new product into database
            const result = await querys({
                query: `INSERT INTO default_setting (commission, weekoff, magamai, logo, marketer_mobile,financialYear,magamaiSource,salesColumn,language,app_language,magamaiType, bill_type, magamai_show) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                values: [commission, weekoff, magamai, imagePath, marketerMobile, year, magamaiSource, initialVisibleColumns, language, app_language, magamaiType, billMode, magamai_show]
            });

            // Check if insertion was successful
            if (result.affectedRows > 0) {
                return NextResponse.json({
                    message: 'Default values added successfully',
                    data: {bill_type:billMode,show:magamai_show,type:magamaiSource},
                    status: 200
                }, { status: 200 });
            }

            return NextResponse.json({
                message: 'Failed to add Default values',
                status: 400
            }, { status: 400 });
        } else {
            return NextResponse.json({
                message: 'Unauthorized',
                status: 403
            }, { status: 403 });
        }

    } catch (error) {
        console.error('Server Error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({
                message: 'Farmer already exists',
                status: 400
            }, { status: 400 });
        }


        return NextResponse.json({
            message: 'Server Error',
            status: 500
        }, { status: 500 });
    }
}


export async function GET(req) {
    try {
        const auth = await verifyToken(req)
        const { decoded } = auth

        if (decoded.role == 'marketer') {
            const [rows] = await querys({
                query: `SELECT * FROM default_setting WHERE marketer_mobile = ?`,
                values: [decoded.mobile]
            })

            if (rows) {
                return NextResponse.json({
                    message: 'Default Setting Listed successfully',
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
        console.error('Server Error:', error);

        return NextResponse.json({
            message: 'Server Error',
            status: 500
        }, { status: 500 });
    }
}


export async function PUT(req) {
    try {
        const auth = await verifyToken(req);
        const data = await req.formData();
        const logo = data.get('file');  
        const commission = parseFloat(data.get('commission'));
        const magamai = parseFloat(data.get('magamai'));
        const weekoff = data.get('weekoff');
        const magamaiSource = data.get('magamaiSource')
        const year = parseInt(data.get('financialYear'));
        const existing = data.get("existingLogo");
        const language = data.get("language");
        const app_language = data.get("app_language")
        const magamaiType = data.get("magamaiType")
        const billMode = data.get("bill_type")
        const magamai_show = parseInt(data.get("magamai_show"))

        const { decoded } = auth;
        const marketerMobile = decoded.mobile;
        const role = decoded.role;

        if (role !== 'marketer') {
            return NextResponse.json({
                message: 'Unauthorized',
                status: 403
            }, { status: 403 });
        }

        let storePath = existing; // Default to existing logo path

        // Check if a new file has been uploaded
        if (!existing && logo) {
            const mimeType = logo.type;
            const validMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!validMimeTypes.includes(mimeType)) {
                return NextResponse.json({
                    success: false,
                    message: 'Invalid file type. Only JPEG, PNG, and JPG are allowed.'
                }, { status: 400 });
            }

            const bytes = await logo.arrayBuffer();
            const buffer = Buffer.from(bytes);

            if (existing) {
                // Extract public ID from Cloudinary URL
                const publicId = existing.split('/').pop().split('.')[0]; 
                await cloudinary.uploader.destroy(`uploads/logo/${publicId}`); // Delete old logo
            }

            const uploadResponse = await cloudinary.uploader.upload(`data:${mimeType};base64,${buffer.toString('base64')}`, {
                folder: 'uploads/logo',
                resource_type: 'image',
            });
    
             storePath = uploadResponse.secure_url;
        }

        // Perform an UPDATE operation, including the logo if it has been changed
        const query = !existing
            ? `UPDATE default_setting SET commission = ?, weekoff = ?, magamai = ?, logo = ?, financialYear = ?, magamaiSource = ?, language = ?, app_language = ? , magamaiType = ?,
            bill_type = ? WHERE marketer_mobile = ?`
            : `UPDATE default_setting SET commission = ?, weekoff = ?, magamai = ?, financialYear = ?, magamaiSource = ?, language = ?, app_language = ?, magamaiType = ?, bill_type = ?,
            magamai_show = ? WHERE marketer_mobile = ?`;

        const values = logo
            ? [commission, weekoff, magamai, storePath, year, magamaiSource, language, app_language, magamaiType, billMode, marketerMobile]  // Including logo path
            : [commission, weekoff, magamai, year, magamaiSource, language, app_language, magamaiType, billMode, magamai_show, marketerMobile,];            // Without logo path if not updated

        const result = await querys({ query, values });

        // Check if the update was successful
        if (result.affectedRows > 0) {
            return NextResponse.json({
                message: 'Default values updated successfully',
                data: {bill_type:billMode,show:magamai_show,type:magamaiSource},
                status: 200
            }, { status: 200 });
        }

        return NextResponse.json({
            message: 'Failed to update Default values',
            status: 400
        }, { status: 400 });

    } catch (error) {
        console.error('Server Error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({
                message: 'Entry already exists',
                status: 400
            }, { status: 400 });
        }

        return NextResponse.json({
            message: 'Server Error',
            status: 500
        }, { status: 500 });
    }
}
