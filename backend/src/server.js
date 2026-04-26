const app = require('./app');
const env = require('./config/env');

if (env.nodeEnv === 'production') {
  const s = env.jwtSecret || process.env.JWT_SECRET || '';
  if (!s || String(s).length < 16) {
    console.error('FATAL: JWT_SECRET must be set to at least 16 characters in production.');
    process.exit(1);
  }
}

app.listen(env.port, () => {
  console.log('');
  console.log('  ═══════════════════════════════════════════════════════');
  console.log('   Fin-Agri Score — Backend API (Objective 2)');
  console.log('  ═══════════════════════════════════════════════════════');
  console.log(`   Listening on  http://localhost:${env.port}`);
  console.log(`   Inference URL ${env.inferenceServiceUrl}`);
  console.log(`   CORS origin   ${env.corsOrigin}`);
  console.log(`   Environment   ${env.nodeEnv}`);
  console.log('  ═══════════════════════════════════════════════════════');
  console.log('');
});
