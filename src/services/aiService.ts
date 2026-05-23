import { GoogleGenAI, Type } from "@google/genai";
import { Dish, WeeklyPlan } from "../types";
import { error } from "console";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateWeeklyMenu = async (
  dishes: Dish[],
  previousPlan: WeeklyPlan | null
): Promise<Partial<WeeklyPlan["days"]>> => {
  try {
  const previousDishIds = previousPlan 
    ? Object.values(previousPlan.days).flatMap(day => [...day.lunch.dishIds, ...day.dinner.dishIds])
    : [];

  const lunchDishes = dishes
    .filter(d => d.suitableForLunch)
    .map(d => ({ id: d.id, name: d.name }));

  const dinnerDishes = dishes
    .filter(d => d.suitableForDinner)
    .map(d => ({ id: d.id, name: d.name }));

  // Guard clause: If no dishes are selected, don't even call the AI
  if (lunchDishes.length === 0 || dinnerDishes.length === 0) {
    throw new Error("No available dishes selected for the plan. Please mark some dishes as available first.");
  } 

  const prompt = `
    Generate a weekly meal plan (Monday to Sunday, Lunch and Dinner) using ONLY the following dishes.
    Dishes available for LUNCH: ${JSON.stringify(lunchDishes)}
    Dishes available for DINNER: ${JSON.stringify(dinnerDishes)}
    
    Constraint:
    1. For each slot (lunch and dinner), provide a LIST of dish IDs. Usually 1 dish, but you can suggest 2 if they complement each other.
    2. At least 50% of the selected dishes SHOULD be different from the previous week's dishes if possible. And do not repeat the same dish in the week.
    Previous week dish IDs: ${JSON.stringify(previousDishIds)}
    
    Return the plan as a JSON object where keys are days of the week (lowercase) and values are objects with "lunch" and "dinner" keys, each containing a "dishIds" array of strings.
  `;
    
  console.log("AI Prompt:", prompt);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          monday: { type: Type.OBJECT, properties: { lunch: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] }, dinner: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] } }, required: ["lunch", "dinner"] },
          tuesday: { type: Type.OBJECT, properties: { lunch: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] }, dinner: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] } }, required: ["lunch", "dinner"] },
          wednesday: { type: Type.OBJECT, properties: { lunch: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] }, dinner: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] } }, required: ["lunch", "dinner"] },
          thursday: { type: Type.OBJECT, properties: { lunch: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] }, dinner: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] } }, required: ["lunch", "dinner"] },
          friday: { type: Type.OBJECT, properties: { lunch: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] }, dinner: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] } }, required: ["lunch", "dinner"] },
          saturday: { type: Type.OBJECT, properties: { lunch: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] }, dinner: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] } }, required: ["lunch", "dinner"] },
          sunday: { type: Type.OBJECT, properties: { lunch: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] }, dinner: { type: Type.OBJECT, properties: { dishIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dishIds"] } }, required: ["lunch", "dinner"] },
        },
        required: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
      }
    }
  });

    return JSON.parse(response.text || "{}");

  } catch (error: any) {
    const apiMessage = error.response?.data?.error?.message || error.message;
    throw new Error(apiMessage || "AI Service encountered an error.");
  }
};

export const suggestNewDish = async (existingDishes: string[]): Promise<Partial<Dish>> => {
  try {
  const prompt = `
    Based on these dishes in our repository: ${existingDishes.join(", ")}, suggest ONE new dish that would complement the menu.
    The new dish MUST follow these guidelines: healthy and balanced, no heavy sauces and follows the Mediterranean or Atlantic diet (or something more exotic like an occasional simple Mexican dish or Chinese dish, for example).
    Provide the name, category, prepTime (minutes), and a list of ingredients with category ("Aceites y Grasas", "Bebidas","Carnes","Cereales y Granos","Dulces y Endulzantes","Especias y Hierbas""Condimentos","Frutas","Frutos Secos","Lácteos","Legumbres","Pescados y Mariscos","Verduras"), name, quantity.
  `;

  console.log(prompt);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          category: { type: Type.STRING },
          prepTime: { type: Type.NUMBER },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.STRING },
                category: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "{}");
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const enrichDishData = async (dish: Dish): Promise<Partial<Dish>> => {
  try {
    const prompt = `
        The following dish has missing data. 
        1. If the dish category is "null" or missing, suggest a category (e.g., "Pasta", "Asian", "Salad").
        2. For every ingredient, assign on of the following categories: "Aceites y Grasas", "Bebidas","Carnes","Cereales y Granos","Dulces y Endulzantes","Especias y Hierbas""Condimentos","Frutas","Frutos Secos","Lácteos","Legumbres","Pescados y Mariscos","Verduras".
        3. If the dish is suitable for lunch or dinner is missing, determine that as well based on the dish name, ingredients and digestibility.
        Dish: ${JSON.stringify(dish)}
      `;

      // Update your responseSchema to include the dish-level category
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING }, // Dish category
              suitableForLunch: { type: Type.BOOLEAN },
              suitableForDinner: { type: Type.BOOLEAN },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    quantity: { type: Type.STRING },
                    category: { type: Type.STRING } // Ingredient category
                  }
                }
              }
            }
          }
        }
      });
      return JSON.parse(response.text || "{}");
  } catch (error: any) {
    throw new Error(`Failed to enrich dish: ${error.message}`);
  }
};
