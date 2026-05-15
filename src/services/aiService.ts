import { GoogleGenAI, Type } from "@google/genai";
import { Dish, WeeklyPlan } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateWeeklyMenu = async (
  dishes: Dish[],
  previousPlan: WeeklyPlan | null
): Promise<Partial<WeeklyPlan["days"]>> => {
  const previousDishIds = previousPlan 
    ? Object.values(previousPlan.days).flatMap(day => [...day.lunch.dishIds, ...day.dinner.dishIds])
    : [];

  const lunchDishes = dishes.filter(d => d.suitableForLunch).map(d => ({ id: d.id, name: d.name }));
  const dinnerDishes = dishes.filter(d => d.suitableForDinner).map(d => ({ id: d.id, name: d.name }));

  const prompt = `
    Generate a weekly meal plan (Monday to Sunday, Lunch and Dinner) using ONLY the following dishes.
    Dishes available for LUNCH: ${JSON.stringify(lunchDishes)}
    Dishes available for DINNER: ${JSON.stringify(dinnerDishes)}
    
    Constraint:
    1. For each slot (lunch and dinner), provide a LIST of dish IDs. Usually 1 dish, but you can suggest 2 if they complement each other.
    2. At least 50% of the selected dishes SHOULD be different from the previous week's dishes if possible.
    Previous week dish IDs: ${JSON.stringify(previousDishIds)}
    
    Return the plan as a JSON object where keys are days of the week (lowercase) and values are objects with "lunch" and "dinner" keys, each containing a "dishIds" array of strings.
  `;

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

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw new Error("AI failed to generate a valid menu");
  }
};

export const suggestNewDish = async (existingDishes: string[]): Promise<Partial<Dish>> => {
  const prompt = `
    Based on these dishes already in our repository: ${existingDishes.join(", ")}, suggest ONE new dish that would complement the menu.
    The new dish MUST follow these guidelines: healthy and balanced, no heavy sauces and follows the Mediterranean or Atlantic diet (or an occasional simple Mexican dish or Chinese dish).
    Provide the name, category, prepTime (minutes), and a list of ingredients (with name and quantity).
  `;

  console.log(prompt);

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
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
};
