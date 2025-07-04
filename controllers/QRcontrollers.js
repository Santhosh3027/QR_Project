const QRCode = require('qrcode');

const generateQR = async (req, res) => {
  const { format, chargeBoxId, evseId, connectorId } = req.body;

  if (!format || !chargeBoxId || (connectorId && !evseId) ) {
    return res.status(404).render('error', { message: "You can create a QR code using both connectorId and evseId, or using only connectorId, but not with just chargeBoxId and connectorId." });
  }

  // Build QR content
  let qrData = '';
  if (format === 'CSV') {
    qrData = `OCPQR011.0,${chargeBoxId},${evseId},${connectorId}`;
  } else if (format === 'JSON') {
    const jsonData = {
      f0: '1.0',
      f1: chargeBoxId,
      f2: evseId,
      f3: connectorId
    };
    qrData = `OCPQR02${JSON.stringify(jsonData)}`;
  }

  try {
    const qrImage = await QRCode.toDataURL(qrData);
    return res.render('result', { qrImage, qrData });

  } catch (err) {
    console.error('QR Generation Error:', err);
    return res.status(500).render('error', { message: "QR generation failed" });
  }
};


module.exports = { generateQR};
