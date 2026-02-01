import express from "express";
import { validateDiscovery } from "@sis/shared/schemas/index.js";
import { runDiscovery } from "../engine/module0.js";

const router = express.Router();
router.post("/discovery",(req,res)=>{
  const v=validateDiscovery(req.body);
  if(!v.ok) return res.status(400).json({ok:false,errors:v.errors});
  const {marketplace,category,count,language}=req.body;
  res.json(runDiscovery({marketplace,category,count,language}));
});
export default router;