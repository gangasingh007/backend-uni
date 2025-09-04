import Resource from "../models/resource.model.js";
import User from "../models/user.model.js";

export const getStats = async (req, res) => {
  try {
    // Use countDocuments() for better performance
    const totalUsers = await User.countDocuments();
    const totalResources = await Resource.countDocuments();

    res.status(200).json({
      users: totalUsers,
      resources: totalResources,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Server error while fetching stats" });
  }
};
