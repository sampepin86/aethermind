const { AuthService } = require('./auth');
const { connectPool } = require('./database');

async function bootstrap() {
  await connectPool();
  const auth = new AuthService();
  console.log('App server initialized.');
}

bootstrap();
