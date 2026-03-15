const config = require('../config');

function authAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Chave de acesso necessária' });
  }
  const key = auth.slice(7).trim();
  if (!config.masterKey || key !== config.masterKey) {
    return res.status(401).json({ success: false, error: 'Chave inválida' });
  }
  next();
}

module.exports = authAdmin;
