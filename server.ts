import express from "express";
import { createServer as createViteServer } from "vite";
import { Telegraf } from "telegraf";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Octokit } from "octokit";
import cookieSession from "cookie-session";
import fs from "fs/promises";
import path from "path";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'default-secret'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: true,
  sameSite: 'none',
  httpOnly: true,
}));

// Initialize Gemini for the Telegram Bot
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const telegramToken = process.env.TELEGRAM_BOT_TOKEN || "8672160694:AAGIPtUCa8xcmLDewY6l9ErYzD5P4ISqpkQ";

async function startServer() {
  // --- Telegram Bot Logic ---
  if (telegramToken) {
    const bot = new Telegraf(telegramToken);

    bot.start((ctx) => {
      ctx.reply(
        "مرحباً بك! أنا بوت خبير في تحسين منشورات التواصل الاجتماعي. 🚀\n" +
        "أرسل لي أي نص، وسأقوم بإعادة صياغته ليكون جذاباً واحترافياً."
      );
    });

    bot.on("text", async (ctx) => {
      const userText = ctx.message.text;
      
      try {
        // For Telegram, we'll use a smart default prompt that covers all bases
        const prompt = `أنت خبير تسويق رقمي محترف. قم بتحسين المنشور التالي لمنصات التواصل الاجتماعي.
              النص الأصلي: "${userText}"
              
              المطلوب:
              1. كتابة "خطاف" (Hook) قوي وجذاب.
              2. إعادة صياغة النص بشكل تفاعلي ومقسم للنقاط.
              3. إضافة رموز تعبيرية (Emojis) مناسبة.
              4. إضافة 5 هاشتاجات قوية.
              5. الترجمة: قدم نسخة مترجمة للإنجليزية في نهاية المنشور.
              
              اجعل النبرة احترافية وجذابة.`;

        const model = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        await ctx.reply(model.text || "عذراً، لم أستطع معالجة النص.");
      } catch (error) {
        console.error("Telegram Bot Error:", error);
        await ctx.reply("عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.");
      }
    });

    bot.launch().catch(err => console.error("❌ Telegram Bot failed:", err));
  }

  // --- GitHub OAuth & Push Logic ---
  app.get('/api/auth/github/url', (req, res) => {
    const redirectUri = `${process.env.APP_URL || `https://${req.get('host')}`}/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: 'repo,user',
    });
    res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
  });

  app.get('/auth/github/callback', async (req, res) => {
    const { code } = req.query;
    try {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const data = await tokenResponse.json();
      if (data.access_token) {
        const session = (req as any).session;
        if (session) {
          session.githubToken = data.access_token;
        }
        res.send(`
          <html><body><script>
            window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS' }, '*');
            window.close();
          </script></body></html>
        `);
      } else {
        res.status(400).send('Failed to get access token');
      }
    } catch (error) {
      res.status(500).send('Authentication error');
    }
  });

  app.get('/api/github/user', async (req, res) => {
    const token = (req as any).session?.githubToken;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.users.getAuthenticated();
    res.json(data);
  });

  app.post('/api/github/push', async (req, res) => {
    const token = (req as any).session?.githubToken;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const { repoName } = req.body;
    const octokit = new Octokit({ auth: token });

    try {
      // 1. Create Repo
      const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
        name: repoName || 'social-post-pro',
        auto_init: true,
      });

      // 2. Get all files
      const filesToPush = [
        'package.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'server.ts', 'metadata.json', '.env.example',
        'src/App.tsx', 'src/main.tsx', 'src/index.css'
      ];

      for (const filePath of filesToPush) {
        try {
          const content = await fs.readFile(path.join(process.cwd(), filePath), 'utf8');
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: repo.owner.login,
            repo: repo.name,
            path: filePath,
            message: `Add ${filePath}`,
            content: Buffer.from(content).toString('base64'),
          });
        } catch (e) {
          console.warn(`Skipping ${filePath}:`, e);
        }
      }

      res.json({ success: true, url: repo.html_url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Express & Vite Logic ---
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", bot_active: !!telegramToken });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Web Server running on http://localhost:${PORT}`);
  });
}

startServer();
