/**
 * Data models for MealFlow
 */

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  members: string[]; // User IDs
}

export interface Ingredient {
  name: string;
  quantity: string;
  category: string; // e.g., "vegetables", "proteins"
}

export interface Dish {
  id: string;
  groupId: string;
  name: string;
  category: string;
  ingredients: Ingredient[];
  prepTime: number; // in minutes
  suitableForLunch: boolean;
  suitableForDinner: boolean;
  isRegular: boolean;

}

export interface MealSlot {
  dishIds: string[];
}

export interface DayPlan {
  lunch: MealSlot;
  dinner: MealSlot;
}

export interface WeeklyPlan {
  id: string;
  groupId: string;
  weekId: string; // e.g., "2026-W20"
  days: {
    monday: DayPlan;
    tuesday: DayPlan;
    wednesday: DayPlan;
    thursday: DayPlan;
    friday: DayPlan;
    saturday: DayPlan;
    sunday: DayPlan;
  };
}
