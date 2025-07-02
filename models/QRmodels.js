const mongoose = require('mongoose')

const QRdata = new mongoose.Schema({
     format : {type:String},
     chargeBoxId : {type:String},
     evseId :  {type:String},
     connectorId : {type:String},
     qrData: {type:String},
     qrImage: {type:String}
})

module.exports = mongoose.model('QRpro',QRdata)