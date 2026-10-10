export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return res.status(200).end();
  }

  const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");
  return res.status(200).json({
    status: "ready",
    provider: "Dory Native AI Engine",
    hasApiKey,
    agentVersion: "Dory-Agent-v2.0"
  });
}
