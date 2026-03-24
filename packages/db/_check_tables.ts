import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(p.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('categories', 'tax_categories', 'menu_items')
    ORDER BY table_name
` as Promise<any[]>).then((result) => {
    console.log('Tables found:', result.map((r: any) => r.table_name));
    return p.$disconnect();
}).catch((e: Error) => {
    console.error('Error:', e.message);
    return p.$disconnect();
});
