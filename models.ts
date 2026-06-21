import mongoose from 'mongoose';

const IngredientSchema = new mongoose.Schema({
  name: String,
  quantity: String,
  category: String
});

const DishSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'Main Course' },
  suitableForLunch: { type: Boolean, default: true },
  suitableForDinner: { type: Boolean, default: true },
  ingredients: [IngredientSchema],
  prepTime: { type: Number, default: 30 },
  isRegular: { type: Boolean, default: true },
  groupId: { type: String, required: true },
  deletedByGroups: { type: [String], default: [] }
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [String] // Array of emails
});

const SlotSchema = new mongoose.Schema({
  dishIds: [String]
});

const DayPlanSchema = new mongoose.Schema({
  lunch: { type: SlotSchema, default: () => ({ dishIds: [] }) },
  dinner: { type: SlotSchema, default: () => ({ dishIds: [] }) }
});

const WeeklyPlanSchema = new mongoose.Schema({
  groupId: { type: String, required: true },
  weekId: { type: String, required: true },
  days: {
    monday: DayPlanSchema,
    tuesday: DayPlanSchema,
    wednesday: DayPlanSchema,
    thursday: DayPlanSchema,
    friday: DayPlanSchema,
    saturday: DayPlanSchema,
    sunday: DayPlanSchema
  }
});

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true }
});

const ShoppingListItemSchema = new mongoose.Schema({
  groupId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: String, default: "" },
  category: { type: String, default: "Other" },
  purchased: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const FridgeItemSchema = new mongoose.Schema({
  groupId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: String, default: "1 unit" },
  category: { type: String, default: "Other" },
  inStock: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', UserSchema);
export const Group = mongoose.model('Group', GroupSchema);
export const Dish = mongoose.model('Dish', DishSchema);
export const WeeklyPlan = mongoose.model('WeeklyPlan', WeeklyPlanSchema);
export const ShoppingListItem = mongoose.model('ShoppingListItem', ShoppingListItemSchema);
export const FridgeItem = mongoose.model('FridgeItem', FridgeItemSchema);
