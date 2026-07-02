const express=require("express");
const {userRegisterController,userLoginController,userLogoutController,refreshAccessTokenController, getMeController, changePasswordController}=require("../controllers/auth.controller")
const {authMiddleware}=require("../middlewares/auth.middleware");
const router=express.Router();

/* POST  /api/v1/auth/register */
router.post("/register",userRegisterController)
/* POST  /api/v1/auth/login */
router.post("/login",userLoginController)
/* POST  /api/v1/auth/logout */
router.post("/logout",userLogoutController);
/* POST  /api/v1/auth/refresh */
router.post("/refresh",refreshAccessTokenController);
/* GET /api/v1/auth/me */
router.get("/me",authMiddleware,getMeController);
/* PATCH /api/v1/auth/change-password */
router.patch("/change-password",authMiddleware,changePasswordController);

module.exports=router;