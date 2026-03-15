const instanceRepository = require('../repositories/instanceRepository');
const evolutionService = require('./evolutionService');

async function listInstances() {
  await syncInstancesFromEvolution();
  const rows = instanceRepository.findAll();
  const withStatus = await Promise.all(
    rows.map(async (row) => {
      let status = row.status;
      try {
        const state = await evolutionService.connectionState(row.evolution_instance_name);
        status = (state && state.instance && state.instance.state) || state?.state || status;
      } catch {
        // keep cached status
      }
      return { ...row, status };
    })
  );
  return withStatus;
}

async function syncInstancesFromEvolution() {
  try {
    const list = await evolutionService.fetchInstances();
    const items = Array.isArray(list) ? list : list?.instances || [];
    const existing = instanceRepository.findAll();
    const existingNames = new Set(existing.map((r) => r.evolution_instance_name));
    for (const item of items) {
      const name = typeof item === 'string' ? item : item?.instanceName || item?.name;
      if (!name || existingNames.has(name)) continue;
      await importExistingInstanceFromEvolution(name, name, typeof item === 'object' ? item : null);
      existingNames.add(name);
    }
  } catch {
    // se Evolution não responder, lista só o que está no banco
  }
}

async function getInstance(id) {
  const row = instanceRepository.findById(id);
  if (!row) return null;
  let status = row.status;
  try {
    const state = await evolutionService.connectionState(row.evolution_instance_name);
    status = (state && state.instance && state.instance.state) || state?.state || status;
  } catch {
    // keep cached
  }
  return { ...row, status };
}

function isAlreadyInUseError(e) {
  const msg = e.body?.response?.message;
  const text = Array.isArray(msg) ? msg.join(' ') : msg || e.message || '';
  return e.status === 403 && /already in use/i.test(text);
}

async function createInstance({ instanceName, label, integration, qrcode, ...rest }) {
  const existing = instanceRepository.findByEvolutionName(instanceName);
  if (existing) {
    const err = new Error('Instance name already exists');
    err.status = 409;
    throw err;
  }
  try {
    const created = await evolutionService.createInstance({
      instanceName,
      integration: integration || 'WHATSAPP-BAILEYS',
      qrcode: qrcode !== false,
      ...rest,
    });
    const instance = created?.instance || created;
    const evolutionInstanceId = instance?.instanceId || instance?.instance_id || null;
    const evolutionApikey = created?.hash?.apikey || created?.apikey || null;
    const row = instanceRepository.create({
      evolution_instance_name: instanceName,
      evolution_instance_id: evolutionInstanceId,
      label: label || instanceName,
      status: instance?.status || 'created',
      evolution_apikey: evolutionApikey,
    });
    return row;
  } catch (e) {
    if (isAlreadyInUseError(e)) {
      const row = await importExistingInstanceFromEvolution(instanceName, label || instanceName);
      return row;
    }
    throw e;
  }
}

async function importExistingInstanceFromEvolution(instanceName, label, rawItemFromList = null) {
  let evolutionInstanceId = null;
  let evolutionApikey = null;
  if (rawItemFromList && typeof rawItemFromList === 'object') {
    evolutionInstanceId = rawItemFromList.instanceId || rawItemFromList.instance_id || null;
    evolutionApikey = rawItemFromList.apikey || rawItemFromList.hash?.apikey || null;
  } else {
    const list = await evolutionService.fetchInstances();
    const names = Array.isArray(list) ? list : list?.instances || [];
    const found = names.find(
      (item) =>
        (typeof item === 'string' && item === instanceName) ||
        (item && (item.instanceName === instanceName || item.name === instanceName))
    );
    if (found && typeof found === 'object') {
      evolutionInstanceId = found.instanceId || found.instance_id || null;
      evolutionApikey = found.apikey || found.hash?.apikey || null;
    }
  }
  let status = 'close';
  try {
    const state = await evolutionService.connectionState(instanceName);
    status = (state && state.instance && state.instance.state) || state?.state || status;
  } catch {
    // keep default
  }
  return instanceRepository.create({
    evolution_instance_name: instanceName,
    evolution_instance_id: evolutionInstanceId,
    label: label || instanceName,
    status,
    evolution_apikey: evolutionApikey,
  });
}

async function getQr(instanceId) {
  const row = instanceRepository.findById(instanceId);
  if (!row) throw new Error('Instance not found');
  const data = await evolutionService.connectInstance(row.evolution_instance_name);
  return data;
}

async function deleteInstance(id) {
  const row = instanceRepository.findById(id);
  if (!row) throw new Error('Instance not found');
  try {
    await evolutionService.deleteInstance(row.evolution_instance_name);
  } catch (e) {
    // delete from DB even if Evolution fails (e.g. already deleted)
  }
  instanceRepository.remove(id);
  return { ok: true };
}

module.exports = {
  listInstances,
  getInstance,
  createInstance,
  getQr,
  deleteInstance,
};
