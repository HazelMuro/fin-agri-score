const { Router } = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const c = require('../controllers/farmersController');

const router = Router();

const farmerCreateSchema = z.object({
  fullName: z.string().min(2),
  gender: z.string().optional(),
  age: z.number().int().positive().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  ward: z.string().optional(),
  farmSizeHa: z.number().nonnegative().optional(),
  phone: z.string().optional(),
  nationalId: z.string().optional(),
  education: z.string().optional(),
  householdSize: z.number().int().nonnegative().optional(),
  maritalStatus: z.string().optional(),
});

const farmerUpdateSchema = farmerCreateSchema.partial();

router.get('/', c.list);
router.get('/:id', c.getOne);
router.post('/', validate({ body: farmerCreateSchema }), c.create);
router.patch('/:id', validate({ body: farmerUpdateSchema }), c.update);
router.delete('/:id', c.remove);

module.exports = router;
