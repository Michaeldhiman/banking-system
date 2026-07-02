const mongoose=require("mongoose");
const bcrypt=require("bcryptjs");
const userSchema=new mongoose.Schema({
    email:{
        type:String,
        required:[true,"Email is required"],
        trim:true,
        unique:[true,"Email already exists"],
        lowercase:true,
        match:[/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,"Invalid Email address"]
    },
    name:{
        type:String,
        required:[true,"Name is required for creating an account"],
        trim:true
    },
    password:{
        type:String,
        required:[true,"Password is required for creating an account"],
        minlength:[6,"Password must be at least 6 characters long"],
        maxlength:[16,"Password must be at most 16 characters long"],
        
    },
    systemUser:{
        type:Boolean,
        default:false,
        immutable:true,
        select:false
    },
    refreshTokenHash:{
        type:String,
        select:false
    }
},{
    timestamps:true,
});

userSchema.pre("save",async function(){
    if(!this.isModified("password")){
        return 
    }
    const hash=await bcrypt.hash(this.password,10);
    this.password=hash;
    return 
});

userSchema.methods.comparePassword=async function(password){
    return await bcrypt.compare(password,this.password);
};

userSchema.methods.compareRefreshToken=async function(refreshToken){
    if(!this.refreshTokenHash) return false;
    return await bcrypt.compare(refreshToken,this.refreshTokenHash);
};
userSchema.index(
    { systemUser: 1 },
    {
        unique: true,
        partialFilterExpression: { systemUser: true }
    }
);

const User=mongoose.model("User",userSchema);

module.exports=User;