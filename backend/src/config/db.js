const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const mongoose=require("mongoose");

function connectToDb(){
    mongoose.connect(process.env.MONGO_URI)
        .then(()=>{
            console.log("Server is connected to DB");
            
        })
        .catch((err)=>{
            console.log("Error connecting to DB");
            console.error(err);   
            process.exit(1);
        })
}
module.exports=connectToDb;