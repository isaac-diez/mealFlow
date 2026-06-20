import dotenv from 'dotenv';

dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { MongoClient, ObjectId } from "mongodb";
import mongoose from 'mongoose';
import { User, Group, Dish, WeeklyPlan, ShoppingListItem } from './models.js';
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

// MongoDB Connection
let client: MongoClient | null = null;
const dbName = "mealflow";

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required");
  }
  
  if (mongoose.connection.readyState === 0) {
    console.log("Connecting Mongoose to MongoDB Atlas...");
    await mongoose.connect(uri, { dbName });
  }

  if (!client) {
    console.log("Connecting MongoClient to MongoDB Atlas...");
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db(dbName);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Connect to DB immediately
  try {
    await getDb();
  } catch (err) {
    console.error("Critical: Could not connect to DB", err);
  }

  // --- Auth Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Invalid token" });
      req.user = user;
      next();
    });
  };

  // --- Auth Routes ---
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ error: "User already exists" });

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        email,
        password: hashedPassword,
        name: name || email.split("@")[0],
      });
      await user.save();
      res.json({ success: true, userId: user._id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      
      if (!user) return res.status(400).json({ error: "User not found" });
      
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(400).json({ error: "Invalid password" });

      const token = jwt.sign({ userId: user._id.toString(), email: user.email, name: user.name }, JWT_SECRET, {
        expiresIn: "7d"
      });
      res.json({ token, user: { id: user._id.toString(), email: user.email, name: user.name } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/me", authenticateToken, (req: any, res) => {
    res.json({ user: req.user });
  });

  // API Routes (Protected)
  app.get("/api/groups", authenticateToken, async (req: any, res) => {
    try {
      const groups = await Group.find({ members: req.user.email });
      res.json(groups.map(g => ({ ...g.toObject(), id: g._id.toString() })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.get("/api/groups/:groupId/dishes", authenticateToken, async (req: any, res) => {
    try {
      const groupId = req.params.groupId;
      const groupCheck = await Group.findById(groupId);
      if (!groupCheck || !groupCheck.members?.includes(req.user.email)) return res.status(403).json({ error: "Unauthorized" });

      // Count dishes for this specific group
      const dishesCount = await Dish.countDocuments({ groupId });
      if (dishesCount === 0) {
        console.log(`[BACKEND] No dishes for group ${groupId}. Seeding separate default dishes...`);
      }

      const dishes = await Dish.find({
        $or: [
          { groupId },
          { isRegular: false }
        ],
        deletedByGroups: { $ne: groupId }
      });
      
      // Sort dishes so that group-owned dishes come first, and within that, regular ones first.
      // This ensures that the deduplication process below always selects the group's custom/regular
      // version over any default or shared vault version of the same dish.
      dishes.sort((a: any, b: any) => {
        const aIsGroup = a.groupId === groupId ? 1 : 0;
        const bIsGroup = b.groupId === groupId ? 1 : 0;
        if (aIsGroup !== bIsGroup) return bIsGroup - aIsGroup;
        
        const aIsReg = a.isRegular !== false ? 1 : 0;
        const bIsReg = b.isRegular !== false ? 1 : 0;
        return bIsReg - aIsReg;
      });
      
      // Filter out duplicate dish names if they exist in this group
      const uniqueDishes = [];
      const seenNames = new Set();
      for (const d of dishes) {
         const nameLower = d.name.toLowerCase().trim();
         if (!seenNames.has(nameLower)) {
            seenNames.add(nameLower);
            uniqueDishes.push({ ...d.toObject(), id: d._id.toString() });
         }
      }

      res.json(uniqueDishes);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch dishes" });
    }
  });

  app.post("/api/groups/:groupId/dishes", authenticateToken, async (req: any, res) => {
    try {
      const groupId = req.params.groupId;
      const groupCheck = await Group.findById(groupId);
      if (!groupCheck || !groupCheck.members?.includes(req.user.email)) return res.status(403).json({ error: "Unauthorized" });

      const newDish = new Dish({
        groupId,
        ...req.body
      });
      await newDish.save();
      res.json({ ...newDish.toObject(), id: newDish._id.toString() });
    } catch (error: any) {
      console.error("Failed to create dish:", error);
      res.status(500).json({ error: "Failed to create dish", details: error.message || error.toString() });
    }
  });

  app.put("/api/groups/:groupId/dishes/:dishId", authenticateToken, async (req: any, res) => {
    try {
      const dishId = req.params.dishId;
      const groupId = req.params.groupId;
      const groupCheck = await Group.findById(groupId);
      if (!groupCheck || !groupCheck.members?.includes(req.user.email)) return res.status(403).json({ error: "Unauthorized" });

      const dish = await Dish.findById(dishId);
      if (!dish) return res.status(404).json({ error: "Dish not found" });
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ error: "Group not found" });

      const updateData = { ...req.body };
      delete updateData._id;
      delete updateData.id;
      updateData.groupId = groupId;

      if (dish.groupId !== groupId || dish.isRegular === false) {
        console.log(`[BACKEND] Cloning shared/vault dish "${dish.name}" (ID: ${dishId}) for group ${group.name}`);
        const clonedDish = new Dish({
          ...dish.toObject(),
          _id: new mongoose.Types.ObjectId(),
          groupId: groupId,
          ...updateData
        });
        await clonedDish.save();
        res.json({ ...clonedDish.toObject(), id: clonedDish._id.toString() });
      } else {
        const result = await Dish.findByIdAndUpdate(dishId, { $set: updateData }, { new: true });
        if (!result) return res.status(404).json({ error: "Dish not found" });

        res.json({ ...result.toObject(), id: result._id.toString() });
      }
    } catch (error: any) {
      console.error("Failed to update dish:", error);
      res.status(500).json({ error: "Failed to update dish", details: error.message || error.toString() });
    }
  });

  app.delete("/api/dishes/:dishId", authenticateToken, async (req: any, res) => {
    const dishId = req.params.dishId;
    console.log(`[BACKEND] DELETE /api/dishes/${dishId} - Start`);
    try {
      if (!mongoose.Types.ObjectId.isValid(dishId)) {
        console.error(`[BACKEND] Invalid ObjectId provided: "${dishId}"`);
        return res.status(400).json({ error: "Invalid dish ID format. Must be a 24-character hex string." });
      }
      
      const result = await Dish.findByIdAndDelete(dishId);
      
      if (!result) {
        console.warn(`[BACKEND] Dish not found in DB with ID: ${dishId}`);
        // We return success anyway to keep frontend in sync if it thought it existed
        return res.json({ success: true, message: "Dish already gone" });
      }

      console.log(`[BACKEND] Successfully deleted dish: "${result.name}" (ID: ${dishId})`);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`[BACKEND] Error during deletion of ${dishId}:`, error);
      res.status(500).json({ error: "Server error during dish deletion", details: error.message });
    }
  });

  // Simplified group-specific delete
  app.delete("/api/groups/:groupId/dishes/:dishId", authenticateToken, async (req: any, res) => {
    const { groupId, dishId } = req.params;
    console.log(`[BACKEND] DELETE /api/groups/${groupId}/dishes/${dishId} - Start`);
    try {
      if (!mongoose.Types.ObjectId.isValid(dishId)) {
        return res.status(400).json({ error: "Invalid dish ID" });
      }

      const groupCheck = await Group.findById(groupId);
      if (!groupCheck || !groupCheck.members?.includes(req.user.email)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const dish = await Dish.findById(dishId);
      if (!dish) return res.json({ success: true });

      if (dish.isRegular === false || dish.groupId !== groupId) {
        // Shared/vault dish - do not delete the main document!
        // Instead, mark all matching vault dishes by name as deleted for this group only
        await Dish.updateMany(
          {
            name: { $regex: new RegExp(`^${dish.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
            isRegular: false
          },
          { $addToSet: { deletedByGroups: groupId } }
        );
        console.log(`[BACKEND] Soft deleted all vault dishes matching name "${dish.name}" (ID: ${dishId}) for group ${groupId}`);
      } else {
        // Group-owned regular dish, delete it fully from DB
        await Dish.findByIdAndDelete(dishId);
        console.log(`[BACKEND] Fully deleted group regular dish: "${dish.name}"`);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[BACKEND] Group-specific deletion error:", error);
      res.status(500).json({ error: "Failed to delete dish", details: error.message });
    }
  });

  app.post("/api/groups", authenticateToken, async (req: any, res) => {
    try {
      const newGroup = new Group({
        ...req.body,
        members: [req.user.email]
      });
      await newGroup.save();
      res.json({ ...newGroup.toObject(), id: newGroup._id.toString() });
    } catch (error) {
      console.error("Failed to create group:", error);
      res.status(500).json({ error: "Failed to create group" });
    }
  });

  app.post("/api/groups/:groupId/members", authenticateToken, async (req: any, res) => {
    try {
      const memberEmail = req.body.email;
      const groupId = req.params.groupId;
      
      const group = await Group.findById(groupId);
      if (!group || !group.members?.includes(req.user.email)) {
         return res.status(403).json({ error: "Not authorized to modify this group" });
      }

      if (group.members.includes(memberEmail)) {
        return res.status(400).json({ error: "Member already in group" });
      }

      group.members.push(memberEmail);
      await group.save();
      
      res.json({ ...group.toObject(), id: group._id.toString() });
    } catch (error) {
      console.error("Failed to add member:", error);
      res.status(500).json({ error: "Failed to add member" });
    }
  });

  app.delete("/api/groups/:groupId/members/:email", authenticateToken, async (req: any, res) => {
    try {
      const emailToRemove = req.params.email;
      const groupId = req.params.groupId;

      const group = await Group.findById(groupId);
      if (!group || !group.members?.includes(req.user.email)) {
        return res.status(403).json({ error: "Not authorized to modify this group" });
      }

      group.members = group.members.filter(m => m !== emailToRemove);
      
      if (group.members.length === 0) {
        return res.status(400).json({ error: "Group must have at least one member" });
      }

      await group.save();
      res.json({ ...group.toObject(), id: group._id.toString() });
    } catch (error) {
      console.error("Failed to remove member:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  app.delete("/api/groups/:groupId", authenticateToken, async (req: any, res) => {
    try {
      const groupId = req.params.groupId;
      const group = await Group.findById(groupId);
      
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      if (!group.members?.includes(req.user.email)) {
        return res.status(403).json({ error: "Not authorized to delete this group" });
      }

      await Group.findByIdAndDelete(groupId);
      await Dish.deleteMany({ groupId });
      await WeeklyPlan.deleteMany({ groupId });
      await ShoppingListItem.deleteMany({ groupId });

      console.log(`[BACKEND] Group "${group.name}" (${groupId}) deleted successfully including all related data.`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete group:", error);
      res.status(500).json({ error: "Failed to delete group", details: error.message || error.toString() });
    }
  });

  app.get("/api/groups/:groupId/plans", authenticateToken, async (req, res) => {
    try {
      const plans = await WeeklyPlan.find({ groupId: req.params.groupId });
      res.json(plans.map(p => ({ ...p.toObject(), id: p._id.toString() })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  app.post("/api/groups/:groupId/plans", authenticateToken, async (req: any, res) => {
    try {
      const groupId = req.params.groupId;
      const groupCheck = await Group.findById(groupId);
      if (!groupCheck || !groupCheck.members?.includes(req.user.email)) return res.status(403).json({ error: "Unauthorized" });

      const newPlan = new WeeklyPlan({
        groupId,
        ...req.body
      });
      await newPlan.save();
      res.json({ ...newPlan.toObject(), id: newPlan._id.toString() });
    } catch (error) {
      res.status(500).json({ error: "Failed to create plan" });
    }
  });

  app.put("/api/plans/:planId", authenticateToken, async (req, res) => {
    try {
      const planId = req.params.planId;
      const { id, _id, ...updateData } = req.body;
      const result = await WeeklyPlan.findByIdAndUpdate(planId, { $set: updateData }, { new: true });
      if (result) {
        res.json({ ...result.toObject(), id: result._id.toString() });
      } else {
        res.status(404).json({ error: "Plan not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to update plan" });
    }
  });

  // Shopping List Routes
  app.get("/api/groups/:groupId/shopping-list", authenticateToken, async (req, res) => {
    try {
      const items = await ShoppingListItem.find({ groupId: req.params.groupId }).sort({ createdAt: 1 });
      res.json(items.map(p => ({ ...p.toObject(), id: p._id.toString() })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shopping list" });
    }
  });

  app.post("/api/groups/:groupId/shopping-list", authenticateToken, async (req, res) => {
    try {
      const newItem = new ShoppingListItem({
        groupId: req.params.groupId,
        ...req.body
      });
      await newItem.save();
      res.json({ ...newItem.toObject(), id: newItem._id.toString() });
    } catch (error) {
      res.status(500).json({ error: "Failed to add item to shopping list" });
    }
  });

  app.put("/api/shopping-list/:itemId", authenticateToken, async (req, res) => {
    try {
      const itemId = req.params.itemId;
      const { id, _id, ...updateData } = req.body;
      const result = await ShoppingListItem.findByIdAndUpdate(itemId, { $set: updateData }, { new: true });
      if (result) {
        res.json({ ...result.toObject(), id: result._id.toString() });
      } else {
        res.status(404).json({ error: "Item not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to update shopping list item" });
    }
  });

  app.delete("/api/shopping-list/:itemId", authenticateToken, async (req, res) => {
    try {
      await ShoppingListItem.findByIdAndDelete(req.params.itemId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete shopping list item" });
    }
  });

  app.delete("/api/groups/:groupId/shopping-list/completed", authenticateToken, async (req, res) => {
    try {
      await ShoppingListItem.deleteMany({ groupId: req.params.groupId, purchased: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear completed items" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
