const express = require('express');
const router = express.Router();
const crimeController = require('../controllers/crime.controller');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, crimeController.getCrimes);
router.get('/types', crimeController.getCrimeTypes);
router.get('/nearby', optionalAuth, crimeController.getCrimesNearby);
router.get('/:id', optionalAuth, crimeController.getCrimeById);

router.post('/', protect, crimeController.createCrime);
router.put('/:id', protect, authorize('admin', 'police'), crimeController.updateCrime);
router.delete('/:id', protect, authorize('admin'), crimeController.deleteCrime);

module.exports = router;
