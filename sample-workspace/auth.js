const { queryDb } = require('./database');
const { getCachedToken, setCachedToken } = require('./cache');

class AuthService {
  constructor() {
    this.sessionTimeout = 3600;
  }

  async authenticateUser(email, passwordHash) {
    const cached = await getCachedToken(email);
    if (cached) return { token: cached, source: 'cache' };

    const user = await queryDb('SELECT * FROM users WHERE email = $1', [email]);
    if (!user) throw new Error('UserNotFound');

    const token = 'jwt_' + Buffer.from(email).toString('base64');
    await setCachedToken(email, token, this.sessionTimeout);
    return { token, source: 'database' };
  }

  validatePermission(userRole, requiredRole) {
    const hierarchy = { admin: 3, editor: 2, viewer: 1 };
    return (hierarchy[userRole] || 0) >= (hierarchy[requiredRole] || 0);
  }
}

module.exports = {
  AuthService,
  defaultInstance: new AuthService()
};
