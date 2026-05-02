/**
 * REST routes for /api/applications — Zod-validated create; list/get/update handlers in controller.
 */

const { Router } = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const c = require('../controllers/applicationsController');

const router = Router();

const applicationCreateSchema = z.object({
  farmerId: z.string().min(1),
  amountRequested: z.number().positive(),
  purpose: z.string().min(2),
  season: z.string().optional(),
  status: z.string().optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(['PENDING', 'SCORED', 'APPROVED', 'REJECTED', 'DISBURSED']),
});

router.get('/', c.list);
router.get('/:id', c.getOne);
router.post('/', validate({ body: applicationCreateSchema }), c.create);
router.patch('/:id/status', validate({ body: statusUpdateSchema }), c.updateStatus);

module.exports = router;
