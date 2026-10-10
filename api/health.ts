export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return res.status(200).end();
  }

  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "Dawry-Security-Engine-v2.0"
  });
}
