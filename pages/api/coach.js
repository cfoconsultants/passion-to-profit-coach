// This runs on Vercel's server, never in the visitor's browser — so the API key
// in your environment variables is never exposed to anyone using the site.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { system, messages } = req.body || {};
  if (!system || !messages) {
    return res.status(400).json({ error: 'Request must include system and messages' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in the environment.');
    return res.status(500).json({ error: 'Server is not configured with an API key yet.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        system,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || `Anthropic API error: ${response.status}`;
      return res.status(response.status).json({ error: message });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Error calling Anthropic API:', err);
    return res.status(500).json({ error: err.message || 'Unknown server error' });
  }
}
