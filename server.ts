import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, GenerateContentResponse, Modality, LiveServerMessage, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Setup WebSocket server for Gemini Live API
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on("connection", async (clientWs: WebSocket) => {
    let session: any = null;
    try {
      session = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a helpful engineering translation and technical assistant.",
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
      });

      clientWs.on("message", (data: any) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio && session) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
          if (parsed.video && session) {
            session.sendRealtimeInput({
              video: { data: parsed.video, mimeType: "image/jpeg" },
            });
          }
        } catch (e) {
          console.error("Error processing client ws message:", e);
        }
      });

      clientWs.on("close", () => {
        if (session) {
          try {
            session.close();
          } catch {}
        }
      });
    } catch (err) {
      console.error("Failed to connect to Gemini Live API:", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: "Failed to establish Live session" }));
      }
    }
  });

  app.use(express.json({ limit: '50mb' }));

  // API Route: Translate Page (Streaming SSE)
  app.post("/api/gemini/translate-page", async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const { base64Data, mimeType, promptText, systemInstruction, modelName } = req.body;
      const model = modelName || 'gemini-3.1-flash-lite';

      let sanitizedMimeType = mimeType || 'application/pdf';
      if (sanitizedMimeType.includes('pdf')) sanitizedMimeType = 'application/pdf';
      else if (sanitizedMimeType.includes('png')) sanitizedMimeType = 'image/png';
      else if (sanitizedMimeType.includes('webp')) sanitizedMimeType = 'image/webp';
      else sanitizedMimeType = 'image/jpeg';

      const mediaPart = {
        inlineData: {
          mimeType: sanitizedMimeType,
          data: base64Data,
        },
      };

      const stream = await ai.models.generateContentStream({
        model,
        contents: [{ parts: [mediaPart, { text: promptText }] }],
        config: {
          systemInstruction,
          temperature: 0.1,
          maxOutputTokens: 8192
        },
      });

      for await (const chunk of stream) {
        const text = (chunk as any).text || "";
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Translate page error:", error);
      res.write(`data: ${JSON.stringify({ error: error?.message || 'Server error' })}\n\n`);
      res.end();
    }
  });

  // API Route: Translate Excel Batch
  app.post("/api/gemini/translate-excel", async (req, res) => {
    try {
      const { batchDataPayload, prompt, systemInstruction, targetModel, responseSchema } = req.body;
      const model = targetModel || 'gemini-3.1-flash-lite';

      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              { text: prompt },
              { text: `【待翻译表格数据 (JSON)】：\n\n${batchDataPayload}` }
            ]
          }
        ],
        config: {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      res.json({ text: response.text || "" });
    } catch (error: any) {
      console.error("Translate excel error:", error);
      res.status(500).json({ error: error?.message || 'Server error' });
    }
  });

  // API Route: Translate Text Chunk (Streaming SSE)
  app.post("/api/gemini/translate-text", async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const { textChunk, prompt, systemInstruction, fileType } = req.body;

      const stream = await ai.models.generateContentStream({
        model: 'gemini-3.1-flash-lite',
        contents: [
          {
            parts: [
              { text: prompt },
              { text: `【待翻译正文】：\n\n${textChunk}` }
            ]
          }
        ],
        config: {
          systemInstruction,
          temperature: 0.1,
          maxOutputTokens: 8192
        }
      });

      for await (const chunk of stream) {
        const text = (chunk as any).text || "";
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Translate text error:", error);
      res.write(`data: ${JSON.stringify({ error: error?.message || 'Server error' })}\n\n`);
      res.end();
    }
  });

  // Setup Vite middleware in dev mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
