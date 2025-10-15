import z from "zod"


const reviewschema = z.object({
    name : z.string().min(3,"the name is too short"),
    review : z.string().min(4, "the review is too short"),
    stars : z.number()
})

export const reviewchecker = (req,res,next)=>{
    const payload = req.body;
    const parsedPayload = reviewschema.safeParse(payload);
    if (!parsedPayload.success) {
      return res.status(400).json({ msg : "Invalid data" });
    }
    next();
}