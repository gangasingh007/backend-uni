import express from "express";
import { reviewchecker } from "../types/reviewChecker.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import Review from "../models/review.model.js";

const router = express.Router();


router.post("/create-review",authMiddleware,reviewchecker ,async(req,res)=>{
    try {
    const {name , review , stars} = req.body;
    const payload = req.body;

    const isExistingreview = await Review.findOne({
        name : name
    })

    if (isExistingreview) return res.status(401).json({msg : "The Review with your name already exists"})

    await Review.create({
       name : name,
       review : review,
       stars : stars
    })

    res.status(201).json({
        msg : "Review Added"
    })
    } catch (error) {
        res.status(500).json({
            msg : "Interal Server Error"
        })    
        console.log(error)
    }


})

router.get("/get-reviews",async(req,res)=>{
    try {
    const reviews = await Review.find({})
    
    res.status(201).json({
        reviews
    })
    } catch (error) {
        res.status(500).json({
            msg : "Interal Server Error"
        })    
        console.log(error)
    }
})


export default router;