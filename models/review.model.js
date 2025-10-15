import mongoose from "mongoose";


const reviewschema = new mongoose.Schema({
    name : {
        type : String,
        required : true,
    },
    review : {
        type : String,
        deflault : ""
    },
    stars : {
        type : Number,
        required : true
    }
})


const Review = mongoose.model("Review",reviewschema)

export default Review