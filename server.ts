import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";

// Ensure AI API key is present
if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY environment variable is not set. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Initialize Firebase Admin safely
let db: FirebaseFirestore.Firestore | null = null;
let bucket: any = null;

try {
  // Use default credentials in AI Studio / Cloud Run
  if (!getApps().length) {
    initializeApp({
      // We will try to rely on application default credentials, or just initialize without explicit cert
      // If a service account is needed, it should be provided via env.
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'sublime-craft-x5jvd.firebasestorage.app'
    });
  }
  db = getFirestore();
  bucket = getStorage().bucket();
  console.log("Firebase Admin initialized successfully.");
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload size for base64 images
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes
  
  // Endpoint to validate and analyze issue via AI Pipeline
  app.post("/api/analyze-issue", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing image" });
      }

      // Convert base64 to parts required by SDK
      // Note: we assume data:image/jpeg;base64, or similar prefix is removed by client
      let mimeType = 'image/jpeg';
      let data = imageBase64;
      if (imageBase64.startsWith('data:')) {
        const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          data = matches[2];
        }
      }

      const combinedSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          isValidIssue: { type: Type.BOOLEAN },
          category: { type: Type.STRING },
          severity: { type: Type.STRING },
          description: { type: Type.STRING },
          riskTrend: { type: Type.STRING },
          riskReason: { type: Type.STRING },
          agent2Output: {
            type: Type.OBJECT,
            properties: {
              estimatedHouseholdsAffected: { type: Type.INTEGER },
              estimatedDailyPeopleImpacted: { type: Type.INTEGER },
              safetyRisk: { type: Type.STRING },
              waterLitersWastedPerDay: { type: Type.INTEGER, nullable: true },
              severityScore: { type: Type.INTEGER },
              safetyScore: { type: Type.INTEGER },
              populationScore: { type: Type.INTEGER },
              impactScoreExplanation: { type: Type.STRING }
            },
            required: ["estimatedHouseholdsAffected", "estimatedDailyPeopleImpacted", "safetyRisk", "severityScore", "safetyScore", "populationScore", "impactScoreExplanation"]
          },
          agent3Output: {
            type: Type.OBJECT,
            properties: {
              immediateAction: { type: Type.STRING },
              permanentFix: { type: Type.STRING },
              estimatedResolutionTime: { type: Type.STRING },
              responsibleAuthority: { type: Type.STRING },
              escalationUrgency: { type: Type.STRING }
            },
            required: ["immediateAction", "permanentFix", "estimatedResolutionTime", "responsibleAuthority", "escalationUrgency"]
          }
        },
        required: ["isValidIssue", "category", "severity", "description", "riskTrend", "riskReason"]
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data
                }
              },
              {
                text: "Analyze this photo for a hyperlocal civic issue reporting app. Valid categories include: Roads (potholes, broken paths, traffic, parking), Water Supply (leaks, shortages, contaminated), Electricity (streetlights, exposed wires, power cuts), Waste Management (garbage, illegal dumping), Drainage & Sewage (blocked drains, waterlogging), Environment (pollution, tree cutting), Public Health (mosquitoes, sanitation), Public Safety (hazards, broken CCTV), Public Infrastructure (broken benches, bus stops), Urban Planning (encroachments), and Accessibility (no ramps, obstacles).\n\nValidate if it's a genuine civic issue based on these. If it's a selfie, a pet, or completely unrelated to civic infrastructure, set isValidIssue to false and category to 'Invalid'.\n\nWhen assigning 'severity', be very realistic and conservative. A small pothole or minor litter is 'Low'. A medium pothole or small water leak is 'Medium'. A large deep pothole on a busy road, major water main break, or completely fallen tree blocking a road is 'High' or 'Critical'. Most everyday issues should be Low or Medium.\n\nAlso, act as an Impact Estimator (fill agent2Output) and Resolution Planner (fill agent3Output) generating plausible scores, immediate/permanent fixes, and the likely responsible authority in Chennai, India."
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: combinedSchema,
        }
      });

      const responseText = response.text;
      if (!responseText) throw new Error("AI returned empty text");
      const combinedJson = JSON.parse(responseText);

      if (!combinedJson.isValidIssue) {
        return res.json({ valid: false, message: "This doesn't look like a civic issue. Please upload a photo of a valid civic problem." });
      }

      res.json({
        valid: true,
        agent1: {
          isValidIssue: combinedJson.isValidIssue,
          category: combinedJson.category,
          severity: combinedJson.severity,
          description: combinedJson.description,
          riskTrend: combinedJson.riskTrend,
          riskReason: combinedJson.riskReason
        },
        agent2: combinedJson.agent2Output,
        agent3: combinedJson.agent3Output
      });
    } catch (error) {
      console.error("AI Analysis failed:", error);
      res.status(500).json({ error: "AI analysis failed. Please try again or use manual entry." });
    }
  });

  // Endpoint to escalate issue
  app.post("/api/escalate-issue", async (req, res) => {
    try {
      const { issueData } = req.body;
      if (!issueData) {
        return res.status(400).json({ error: "Missing issue data" });
      }

      const letterPrompt = `
      Draft a formal complaint letter addressed to "The Officer, ${issueData.agent3Output?.responsibleAuthority || 'Concerned Authority'}, Chennai".
      Use the following issue data:
      Category: ${issueData.category}
      Description: ${issueData.description}
      Area: ${issueData.areaName}
      Impact Score: ${issueData.impactScoreBreakdown?.impactScore}
      Estimated Daily People Impacted: ${issueData.agent2Output?.estimatedDailyPeopleImpacted}
      
      Maintain a professional tone. Request resolution within 7 days for Urgent/Critical issues or 14 days for Routine.
      Do not include placeholders for my name, just end with "A Concerned Citizen".
      Return ONLY the letter text. No markdown, no preambles.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: letterPrompt }] }]
      });

      res.json({ letter: response.text });
    } catch (error: any) {
      console.error("Escalation failed:", error);
      
      // Fallback letter if AI generation fails (e.g. due to rate limits)
      const fallbackLetter = `To The Officer, ${req.body.issueData?.agent3Output?.responsibleAuthority || 'Concerned Authority'}, Chennai\n\nSubject: Urgent attention required regarding ${req.body.issueData?.category || 'civic issue'} at ${req.body.issueData?.areaName || 'the reported location'}\n\nDear Sir/Madam,\n\nI am writing to formally report an issue regarding "${req.body.issueData?.description || 'a civic problem'}". This is severely impacting our community and requires immediate attention. We request a resolution at the earliest.\n\nSincerely,\nA Concerned Citizen`;
      
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
        return res.json({ letter: fallbackLetter });
      }

      res.status(500).json({ error: "Failed to draft letter. Please try again later.", fallbackLetter });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
