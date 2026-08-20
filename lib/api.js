function extractJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // The model occasionally wraps the JSON with a stray conversational reaction
    // (e.g. "Oh, that is..." before the actual object). Pull out the {...} span and retry.
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw e;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callClaudeRaw(system, messages) {
  const response = await fetch('/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const err = new Error(payload.error || `Request failed: ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const text = (payload.content || []).map((b) => b.text || '').join('');
  const clean = text.replace(/```json|```/g, '').trim();
  return extractJson(clean);
}

export async function callClaude(system, messages, attempt = 1) {
  try {
    return await callClaudeRaw(system, messages);
  } catch (err) {
    const maxAttempts = 4;
    console.warn(`Attempt ${attempt} failed [${err.name || 'Error'}]: ${err.message}`);
    if (attempt >= maxAttempts) throw err;

    if (err.status === 429) {
      const wait = 1200 * attempt;
      console.warn(`Rate limited, waiting ${wait}ms before retry...`);
      await delay(wait);
    } else {
      await delay(500 * attempt);
    }
    return callClaude(system, messages, attempt + 1);
  }
}

export { delay };
