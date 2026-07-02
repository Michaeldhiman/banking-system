const mongoose=require("mongoose");
const ledgerModel=require("./ledger.model");

const accountSchema=new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:[true,"Account must belong to a user"],
        index:true
    },
    status: {
        type: String,
        enum: {
            values: ["Active", "Frozen", "Closed"],
            message: "Status must be either Active, Frozen or Closed"
        },
        default: "Active"
    },
    currency: {
        type: String,
        uppercase: true,
        default: "INR",
        validate: {
            validator: function (value) {
                return /^[A-Z]{3}$/.test(value);
            },
        message: "Currency must be a 3-letter uppercase code."
    }
}
},{
    timestamps:true
})
// search index for user and status to get all accounts of a user with a particular status  (compound index)
accountSchema.index({user:1,status:1});
accountSchema.methods.getBalance=async function(session = null){
    const balanceData=await ledgerModel.aggregate([
        {$match:{account:this._id}},
        {
                $group:{
                    _id:null,
                    totalDebit:{
                        $sum:{
                            $cond:[
                                {$eq:["$type","Debit"]},
                                "$amount",
                                0
                            ]
                        }
                    },
                    totalCredit:{
                        $sum:{
                            $cond:[
                                {$eq:["$type","Credit"]},
                                "$amount",
                                0
                            ]
                        }   
                    }
                }

        },
        {
            $project:{
                _id:0,
                balance:{
                    $subtract:["$totalCredit","$totalDebit"]
                }
            }
        }
    ]).session(session);;

    // if no ledger entries found,balanceData will be empty array,return 0 as balance
    if(balanceData.length===0){
        return 0;
    }
    return balanceData[0].balance;
}
    


const accountModel=mongoose.model("Account",accountSchema);

module.exports=accountModel;