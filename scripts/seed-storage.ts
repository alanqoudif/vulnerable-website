// Uploads synthetic placeholder content for every seeded `files` row. Run: npm run seed:storage
try { process.loadEnvFile('.env') } catch { /* env may be provided by the shell */ }
const { seedStorage } = await import('../netlify/lib/storage')
console.log('uploaded', await seedStorage(), 'synthetic files')
export {}
