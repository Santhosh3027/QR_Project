const QRdata = require('../models/QRmodels')
const QRCode = require('qrcode');

const generateQR = async (req, res) => {
  const { format, chargeBoxId, evseId, connectorId } = req.body;

  if (!format || !chargeBoxId || !evseId || !connectorId) {
   return res.status(400).json({ message: "Missing data fields" });
  }

  const existingQR = await QRdata.findOne({ chargeBoxId });
  if (existingQR) {
    return res.status(409).render('error', { message: "ChargeBox ID already exists" });
  }

  let qrData = '';

  if (format === 'CSV') {
    qrData = `OCPQR011.0,${chargeBoxId}`;
    if (evseId) qrData += `,${evseId}`;
    if (connectorId) qrData += `,${connectorId}`;
  } else if (format === 'JSON') {
    const jsonData = {
      f0: '1.0',
      f1: chargeBoxId
    };
    if (evseId) jsonData.f2 = evseId;
    if (connectorId) jsonData.f3 = connectorId;

    qrData = `OCPQR02${JSON.stringify(jsonData)}`;
  }

  try {
    const qrImage = await QRCode.toDataURL(qrData);

    const storeinput = new QRdata({
      format, chargeBoxId, evseId, connectorId, qrData, qrImage
    });
    await storeinput.save();

    return res.render('result', { qrImage, qrData });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).render('error', { message: "QR generation failed" });
  }
};

module.exports = { generateQR };