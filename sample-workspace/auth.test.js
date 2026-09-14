const { AuthService } = require('./auth');

async function testAuth() {
  const auth = new AuthService();
  const res = await auth.authenticateUser('test@aethermind.ai', 'secret');
  if (!res.token) throw new Error('Test failed: Token missing');
  console.log('✔ Auth test passed');
}

testAuth();
