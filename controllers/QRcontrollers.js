const QRdata = require('../models/QRmodels');
const QRCode = require('qrcode');

const generateQR = async (req, res) => {
  const { format, chargeBoxId, evseId, connectorId } = req.body;

  if (!format || !chargeBoxId || !evseId || !connectorId) {
    return res.status(400).render('error', { message: "Missing data fields" });
  }

  const existingQR = await QRdata.findOne({ chargeBoxId });
  if (existingQR) {
    return res.status(409).render('error', { message: "ChargeBox ID already exists" });
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
    // Generate QR Image (Base64 PNG)
    const qrImage = await QRCode.toDataURL(qrData);

    // Store everything in MongoDB
    const storeinput = new QRdata({
      format,
      chargeBoxId,
      evseId,
      connectorId,
      qrData,
      qrImage
    });
    await storeinput.save();

    // Show QR code in browser
    return res.render('result', { qrImage, qrData });

  } catch (err) {
    console.error('QR Generation Error:', err);
    return res.status(500).render('error', { message: "QR generation failed" });
  }
};

const searchQRbyID = async(req,res)=>{
    const {chargeBoxId}=req.body;
     if(!chargeBoxId){
        res.status(400).json({message:"chargeBoxId missing"})
    }
    try{
    const findQR = await QRdata.findOne({chargeBoxId});
    if(!findQR){
        res.status(404).json({message:"Generate QR First"})
    }
    res.status(200).json({
        chargeBoxId: findQR.chargeBoxId,
        qrData: findQR.qrData,
        qrImage: findQR.qrImage 
    })
    }catch(err){
        onsole.error('Error in searchQRbyID:', err);
        res.status(500).json({message:"server error"})
    }
    
}
module.exports = { generateQR , searchQRbyID};
