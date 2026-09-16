import { readFileSync, writeFileSync } from 'node:fs';
const databaseId=process.argv[2]||process.env.CLOUDFLARE_D1_DATABASE_ID;
if(!databaseId||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(databaseId))throw new Error('Pass your D1 database_id as an argument or CLOUDFLARE_D1_DATABASE_ID.');
const built=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
const config={name:'nunchi-omok',main:'dist/server/index.js',compatibility_date:built.compatibility_date,compatibility_flags:built.compatibility_flags,no_bundle:true,rules:built.rules,assets:{directory:'dist/client'},d1_databases:[{binding:'DB',database_name:'nunchi-omok-db',database_id:databaseId,migrations_dir:'drizzle'}],observability:{enabled:true}};
writeFileSync('cloudflare.deploy.json',JSON.stringify(config,null,2));
console.log('Prepared cloudflare.deploy.json for your Cloudflare account.');
