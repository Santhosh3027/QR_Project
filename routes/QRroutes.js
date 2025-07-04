const express = require('express');
const {generateQR} = require('../controllers/QRcontrollers');

const router = express.Router()

router.get('/', (req, res) => {
  res.render('form');
});

router.post('/generate',generateQR)

module.exports = router