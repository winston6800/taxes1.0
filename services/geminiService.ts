import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReceiptEntry } from "../types";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const receiptSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    date: {
      type: Type.STRING,
      description: "The date of the transaction found on the receipt (MM/DD/YYYY format preferred). If multiple receipts, use the date of the most recent one.",
    },
    explanation: {
      type: Type.STRING,
      description: "A short description of the contents or items purchased (e.g., 'Lumber Wood', 'Hex nut', 'Labor Cost'). If multiple receipts are in the file, summary them e.g. 'Multiple Hardware items'.",
    },
    store: {
      type: Type.STRING,
      description: "The name of the store, vendor, or merchant. If multiple stores, return 'Multiple Stores' or the primary one.",
    },
    category: {
      type: Type.STRING,
      description: "Classify this receipt as either 'Repairs' or 'Utilities' based on the items. If it involves building materials, labor, or hardware, it is 'Repairs'. If it is electricity, water, or gas bill, it is 'Utilities'. Default to 'Repairs' if unsure.",
      enum: ["Repairs", "Utilities"]
    },
    amount: {
      type: Type.NUMBER,
      description: "The total amount of the receipt. CRITICAL: If the image or PDF contains MULTIPLE receipts, you MUST SUM the totals of all distinct receipts visible.",
    }
  },
  required: ["date", "explanation", "store", "category", "amount"],
};

export const processReceiptImage = async (file: File, nextInvoiceId: number): Promise<Omit<ReceiptEntry, 'batchId'>> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = await fileToGenerativePart(file);

  const model = "gemini-2.5-flash"; // Excellent for vision and document tasks

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          },
          {
            text: "Extract data from this receipt (or PDF document) for a renovation expense tracker. Identify the Date, Store, and a brief Explanation of items. Determine the total cost. Categorize the expense strictly as either 'Repairs' or 'Utilities'. IMPORTANT: If the file contains multiple pages or multiple distinct receipts, calculate the sum of ALL totals."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No data returned from AI");

    const data = JSON.parse(jsonText);
    
    // Map AI response to our application state structure
    // We separate the 'amount' into either repairs or utilities column based on the AI's categorization
    const isRepairs = data.category === 'Repairs';

    return {
      id: crypto.randomUUID(),
      invoiceNumber: nextInvoiceId,
      date: data.date || new Date().toLocaleDateString(),
      explanation: data.explanation || "Unknown Item",
      store: data.store || "Unknown Store",
      repairs: isRepairs ? (data.amount || 0) : 0,
      utilities: !isRepairs ? (data.amount || 0) : 0,
      imageUrl: URL.createObjectURL(file),
      fileName: file.name
    };

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};