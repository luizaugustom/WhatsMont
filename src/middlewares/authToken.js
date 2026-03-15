const tokenService = require('../services/tokenService');

function authToken(req, res, next) {
  const auth = req.headers.authorization;
  const tokenRecord = tokenService.validateToken(auth);
  if (!tokenRecord) {
    return res.status(401).json({ success: false, error: 'Token inválido ou inativo' });
  }
  req.tokenRecord = tokenRecord;
  req.instanceId = tokenRecord.instance_id;
  req.evolutionInstanceName = tokenRecord.evolution_instance_name;
  next();
}

module.exports = authToken;
