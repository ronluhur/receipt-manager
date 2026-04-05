// Vercel Serverless Function — password verification
// Compares the submitted password against the APP_PASSWORD environment variable

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body || {};
  const correctPassword = process.env.APP_PASSWORD;

  if (!correctPassword) {
    // If no password is set, let everyone in
    return res.status(200).json({ ok: true });
  }

  if (password === correctPassword) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false, error: "Incorrect password" });
}
