const mongoose = require ('mongoose')

const ConnectedDB = async()=>{
    try{
       await mongoose.connect(process.env.MONGO_URL)
       console.log("MONGODB Connected")
    }catch{
        console.log("MONGODB not Connected")
    }
}

module.exports = ConnectedDB