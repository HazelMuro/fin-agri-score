/**
 * Autofill / environmental endpoints used by the scoring flow (NASA POWER + satellite row persistence).
 */

const environmentService = require('../services/environmentService');
const auditService = require('../services/auditService');

async function autofill(req, res) {
  const applicationId = req.params.applicationId;
  const force = req.query?.force === 'true' || req.body?.force === true;

  const { saved, meta } = await environmentService.autofillForApplication(
    applicationId,
    { force }
  );

  if (!meta?.reused) {
    await auditService.log({
      applicationId,
      action: 'ENVIRONMENT_AUTOFILLED',
      details: {
        source: saved.source,
        sourceKind: saved.sourceKind,
        rainfall90dMm: saved.rainfall90dMm,
        ndvi90dMean: saved.ndvi90dMean,
        environmentRisk: saved.environmentRisk,
        latitude: meta.latitude,
        longitude: meta.longitude,
        agroEcoZone: meta.agroEcoZone,
      },
    });
  }

  res.status(meta?.reused ? 200 : 201).json({ saved, meta });
}

async function confirm(req, res) {
  const applicationId = req.params.applicationId;
  const userId = req.body?.actingUserId || null;

  const saved = await environmentService.confirmForApplication(applicationId, {
    userId,
  });

  await auditService.log({
    applicationId,
    userId,
    action: 'ENVIRONMENT_CONFIRMED',
    details: {
      source: saved.source,
      sourceKind: saved.sourceKind,
      confirmedAt: saved.confirmedAt,
    },
  });

  res.json({ saved });
}

async function edit(req, res) {
  const applicationId = req.params.applicationId;
  const patch = req.body || {};
  const saved = await environmentService.editForApplication(applicationId, patch);

  await auditService.log({
    applicationId,
    action: 'ENVIRONMENT_EDITED',
    details: {
      patchedFields: Object.keys(patch),
    },
  });

  res.json({ saved });
}

module.exports = { autofill, confirm, edit };
