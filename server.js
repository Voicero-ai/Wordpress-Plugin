/***************************************************************
 * server.js -- FULL CODE (no skipping!)
 ***************************************************************/

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const multer = require("multer");
const fs = require("fs");
const speech = require("@google-cloud/speech");
const textToSpeech = require("@google-cloud/text-to-speech");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fetch = require("node-fetch");

// Load environment variables (GEMINI_API_KEY, etc.)
require("dotenv").config();

const sessions = new Map();

const app = express();
const PORT = 5001;

/***************************************************************
 * GOOGLE CLOUD CLIENTS
 ***************************************************************/
// 1) Google Cloud Speech-to-Text client
const speechClient = new speech.SpeechClient({
  // Use environment variables for credentials in production
  credentials: process.env.GOOGLE_CREDENTIALS
    ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
    : { keyFilename: "linear-axle-447706-b5-432204c975c8.json" },
});

// 2) Google Cloud Text-to-Speech client
const ttsClient = new textToSpeech.TextToSpeechClient({
  // Use environment variables for credentials in production
  credentials: process.env.GOOGLE_CREDENTIALS
    ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
    : { keyFilename: "linear-axle-447706-b5-432204c975c8.json" },
});

/** CUSTOM CORS CONFIG **/
const whitelist = [
  "https://test-store-vocero.myshopify.com",
  "https://admin.shopify.com",
  "https://alias.local",
  /\.myshopify\.com$/,
  "http://localhost:3000",
  "http://localhost:5001",
];

const corsOptions = {
  origin: (origin, callback) => {
    console.log("Request Origin:", origin);
    if (!origin) return callback(null, true); // for non-browser requests
    if (
      whitelist.some((entry) =>
        entry instanceof RegExp ? entry.test(origin) : entry === origin
      )
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
// Configure multer to store files in memory (no temp file by default)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
});

/***************************************************************
 * GEMINI ROUTE
 * Forces JSON output with keys: "response" + "redirect_url"
 ***************************************************************/
app.post("/gemini", async (req, res) => {
  const { query, context } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    // Extract navigation-relevant content first
    const pages = context.match(/Pages:[\s\S]*?(?=Posts:|$)/)?.[0] || "";
    const posts = context.match(/Posts:[\s\S]*?(?=Products:|$)/)?.[0] || "";
    const products = context.match(/Products:[\s\S]*?(?=$)/)?.[0] || "";

    // Create a context that prioritizes navigation
    const aiPayload = {
      contents: [
        {
          parts: [
            {
              text: `
                You are a website assistant. Your task:
                1. First check if query matches any Pages/Posts/Products
                2. If yes, ALWAYS provide redirect_url to that content
                3. Only if no matches, then check current page text
                4. Provide scroll_to_text only if staying on current page

                NAVIGATION PRIORITY:
                - Pages/Posts/Products are PRIMARY content
                - Current page text is SECONDARY
                - Always redirect for specific content requests

                Available Navigation Options:
                ${pages}
                ${posts}
                ${products}

                Current Page Content:
                ${
                  context.match(
                    /TEXT INDEX[\s\S]*?(?=Previous conversation|$)/
                  )?.[0] || ""
                }

                User: ${query}

                Respond with this exact JSON format:
                {
                  "response": "Your helpful reply",
                  "redirect_url": "URL if content exists or null",
                  "scroll_to_text": "Exact text to scroll to (only if no redirect), or null"
                }
              `,
            },
          ],
        },
      ],
    };

    // Send to Gemini
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent",
      aiPayload,
      {
        headers: { "Content-Type": "application/json" },
        params: {
          key: process.env.GEMINI_API_KEY,
        },
      }
    );

    return res.json(response.data);
  } catch (error) {
    console.error("❌ [Gemini Route] Error:", error);
    return res.status(500).json({ error: "Failed to fetch from Gemini API" });
  }
});

/***************************************************************
 * TRANSCRIBE ROUTE
 * Accepts audio file, uses Google Speech-to-Text, returns text
 ***************************************************************/
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    // Check if file is included
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    // Convert audio buffer to base64
    const audioBytes = req.file.buffer.toString("base64");

    // Prepare request for Google STT
    const sttRequest = {
      audio: { content: audioBytes },
      config: {
        // Let Google auto-detect the encoding
        languageCode: "en-US",
      },
    };

    // Send request to Google Speech-to-Text
    const [sttResponse] = await speechClient.recognize(sttRequest);

    // Extract transcription
    const transcription = sttResponse.results
      .map((r) => r.alternatives[0].transcript)
      .join("\n");

    console.log("🎙️ [Transcribe] Transcription result:", transcription);

    // Return the transcription to the client
    return res.json({ transcription });
  } catch (error) {
    console.error("❌ [Transcribe] Error:", error);
    return res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

/***************************************************************
 * SPEAK ROUTE
 * Converts text to speech (MP3) using Google TTS, returns audio
 ***************************************************************/
app.post("/speak", async (req, res) => {
  const { text } = req.body;
  console.log("📥 [TTS] Received text:", text);

  if (!text) {
    return res
      .status(400)
      .json({ error: "Text is required for speech synthesis" });
  }

  try {
    // TTS request configuration
    const ttsRequest = {
      input: { text },
      voice: {
        languageCode: "en-US",
        name: "en-US-Journey-D", // Example voice, pick from Google's voice list
        ssmlGender: "MALE",
      },
      audioConfig: {
        audioEncoding: "MP3",
        // speakingRate: 1.2, // optional
      },
    };

    console.log("🔎 [TTS] Sending to Google TTS:", ttsRequest);

    // Request TTS from Google
    const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
    const audioContent = ttsResponse.audioContent;

    console.log("🔊 [TTS] Audio (MP3) generated successfully");

    // Return the MP3 audio directly to the client
    res.setHeader("Content-Type", "audio/mpeg");
    return res.send(audioContent);
  } catch (error) {
    console.error("❌ [TTS] Error:", error);
    return res.status(500).json({ error: "Failed to generate speech" });
  }
});

// Add new route to handle store data
app.post("/store-data", async (req, res) => {
  try {
    const sessionId = Date.now().toString();
    const storeData = req.body.store_data;

    // Store the data with the session ID
    sessions.set(sessionId, storeData);

    // Clean up old sessions after 1 hour
    setTimeout(() => {
      sessions.delete(sessionId);
    }, 3600000);

    console.log("📥 [Store Data] Received store data for session:", sessionId);
    res.json({ sessionId });
  } catch (error) {
    console.error("❌ [Store Data] Error:", error);
    res.status(500).json({ error: "Failed to store data" });
  }
});

// Add route to retrieve store data
app.get("/get-store-data", (req, res) => {
  const { sessionId } = req.query;
  const data = sessions.get(sessionId);

  if (data) {
    console.log("📤 [Store Data] Returning data for session:", sessionId);
    res.json(data);
  } else {
    console.log("❌ [Store Data] Session not found:", sessionId);
    res.status(404).json({ error: "Session not found" });
  }
});

// Serve the public folder (index.html must be inside public/)
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
