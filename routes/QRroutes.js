const express = require('express');
const {generateQR,searchQRbyID} = require('../controllers/QRcontrollers');

const router = express.Router()

router.get('/', (req, res) => {
  res.render('form');
});

router.post('/generate',generateQR)
router.post('/getqr',searchQRbyID)

module.exports = router