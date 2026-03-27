function createApiClient({ env, apiTimeoutMs }) {
  const API_TIMEOUT_MS = Math.max(15000, Number.parseInt(apiTimeoutMs || '90000', 10) || 90000);

  async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS, externalSignal = null) {
    if (externalSignal?.aborted) {
      throw new Error('Generation cancelled by user.');
    }

    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (externalSignal) {
      externalSignal.addEventListener('abort', forwardAbort, { once: true });
    }

    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      if (externalSignal?.aborted) {
        throw new Error('Generation cancelled by user.');
      }
      if (error?.name === 'AbortError') {
        throw new Error(`API request timed out after ${timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', forwardAbort);
      }
    }
  }

  function extractJsonObject(text) {
    if (typeof text !== 'string') {
      throw new Error('API response was not valid text.');
    }
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return JSON.parse(trimmed);
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('API response did not contain a JSON object.');
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  async function callOpenAiBlueprintAnalysis(payload) {
    const model = env.OPENAI_MODEL || 'gpt-4o';
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an aviation training assessment designer. Analyze chapter sections and allocate weighted question requirements for comprehensive evaluation. Return JSON only.',
          },
          {
            role: 'user',
            content: payload?.promptText || JSON.stringify(payload),
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response did not include completion content.');
    }

    return {
      modelUsed: 'openai',
      modelVersion: model,
      analysis: extractJsonObject(content),
    };
  }

  async function callAnthropicBlueprintAnalysis(payload) {
    const model = env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        temperature: 0.2,
        system: [
          'You are an aviation training design analyst.',
          'Analyze section relevance and return strict JSON only.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: JSON.stringify(payload),
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const textParts = (data?.content || [])
      .filter((part) => part?.type === 'text')
      .map((part) => part?.text || '')
      .join('\n');

    if (!textParts) {
      throw new Error('Anthropic response did not include completion content.');
    }

    return {
      modelUsed: 'anthropic',
      modelVersion: model,
      analysis: extractJsonObject(textParts),
    };
  }

  async function callGeminiJson(systemPrompt, payload, modelHint = null, requestOptions = {}) {
    const model = modelHint || env.GEMINI_MODEL || 'gemini-2.5-flash';
    const timeoutMs = Math.max(1000, Number(requestOptions?.timeoutMs) || API_TIMEOUT_MS);
    const signal = requestOptions?.signal || null;
    const promptText = [
      `${systemPrompt || ''}`.trim(),
      '',
      'Return valid JSON only.',
      '',
      'Payload JSON:',
      JSON.stringify(payload),
    ].join('\n');

    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY || '')}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.2,
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }],
            },
          ],
        }),
      },
      timeoutMs,
      signal
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini request failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const textParts = (data?.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');

    if (!textParts) {
      throw new Error('Gemini response did not include completion content.');
    }

    return {
      modelUsed: 'gemini',
      modelVersion: model,
      json: extractJsonObject(textParts),
      usage: null,
    };
  }

  async function callGeminiBlueprintAnalysis(payload) {
    const system = [
      'You are an aviation training assessment designer.',
      'Analyze chapter sections and allocate weighted question requirements for comprehensive evaluation.',
      'Return JSON only.',
    ].join(' ');

    const result = await callGeminiJson(system, {
      promptText: payload?.promptText || '',
      sectionsJson: payload?.sectionsJson || [],
      chapterTitle: payload?.chapterTitle || 'Unknown',
      bookId: payload?.bookId || 'DOC',
      chapterId: payload?.chapterId || null,
    });

    return {
      modelUsed: result.modelUsed,
      modelVersion: result.modelVersion,
      analysis: result.json,
    };
  }

  async function callOpenAiJson(systemPrompt, payload, modelHint = null, requestOptions = {}) {
    const model = modelHint || env.OPENAI_MODEL || 'gpt-4o';
    const timeoutMs = Math.max(1000, Number(requestOptions?.timeoutMs) || API_TIMEOUT_MS);
    const signal = requestOptions?.signal || null;
    const promptText = `${systemPrompt || ''}`;
    const enforcedSystemPrompt = /json/i.test(promptText)
      ? promptText
      : `${promptText} Return valid JSON only.`.trim();
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: enforcedSystemPrompt },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        temperature: 0.2,
      }),
    }, timeoutMs, signal);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response did not include completion content.');
    }

    return {
      modelUsed: 'openai',
      modelVersion: model,
      json: extractJsonObject(content),
      usage: data?.usage || null,
    };
  }

  async function callAnthropicJson(systemPrompt, payload, modelHint = null, requestOptions = {}) {
    const model = modelHint || env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const timeoutMs = Math.max(1000, Number(requestOptions?.timeoutMs) || API_TIMEOUT_MS);
    const signal = requestOptions?.signal || null;
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      }),
    }, timeoutMs, signal);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const textParts = (data?.content || [])
      .filter((part) => part?.type === 'text')
      .map((part) => part?.text || '')
      .join('\n');

    if (!textParts) {
      throw new Error('Anthropic response did not include completion content.');
    }

    return {
      modelUsed: 'anthropic',
      modelVersion: model,
      json: extractJsonObject(textParts),
      usage: {
        prompt_tokens: Number(data?.usage?.input_tokens || 0),
        completion_tokens: Number(data?.usage?.output_tokens || 0),
      },
    };
  }

  function getProviderOrder(providers) {
    const available = Array.isArray(providers) ? providers.slice() : [];
    const priorityRaw = `${env.API_PROVIDER_PRIORITY || ''}`.trim();
    if (!priorityRaw) {
      return available;
    }

    const preferred = priorityRaw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const ordered = [];
    preferred.forEach((provider) => {
      if (available.includes(provider) && !ordered.includes(provider)) {
        ordered.push(provider);
      }
    });
    available.forEach((provider) => {
      if (!ordered.includes(provider)) {
        ordered.push(provider);
      }
    });
    return ordered;
  }

  function getApiStatus() {
    const providers = [];

    if (typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.trim() !== '') {
      providers.push('openai');
    }

    if (typeof env.ANTHROPIC_API_KEY === 'string' && env.ANTHROPIC_API_KEY.trim() !== '') {
      providers.push('anthropic');
    }

    if (typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim() !== '') {
      providers.push('gemini');
    }

    return {
      available: providers.length > 0,
      providers,
    };
  }

  async function verifyApiProviders() {
    const status = getApiStatus();
    const checks = {
      openai: {
        configured: status.providers.includes('openai'),
        verified: false,
        model: '',
        error: '',
      },
      gemini: {
        configured: status.providers.includes('gemini'),
        verified: false,
        model: '',
        error: '',
      },
    };

    const verifyOne = async (provider) => {
      if (!checks[provider]?.configured) {
        return;
      }

      try {
        const result = await callApiJson(
          provider,
          'Return strict JSON only with shape: {"ok": true}.',
          { ping: 'healthcheck' }
        );
        checks[provider].verified = true;
        checks[provider].model = `${result?.modelVersion || ''}`.trim();
      } catch (error) {
        checks[provider].verified = false;
        checks[provider].error = `${error?.message || error || 'Unknown error.'}`
          .replace(/\s+/g, ' ')
          .trim();
      }
    };

    await Promise.all([
      verifyOne('openai'),
      verifyOne('gemini'),
    ]);

    const verifiedProviders = Object.entries(checks)
      .filter(([, value]) => value.configured && value.verified)
      .map(([provider]) => provider);

    return {
      available: status.available,
      providers: status.providers,
      verifiedAvailable: verifiedProviders.length > 0,
      verifiedProviders,
      checks,
    };
  }

  async function callPreferredApiJson(systemPrompt, payload, modelHint = null, requestOptions = {}) {
    const status = getApiStatus();
    if (!status.available) {
      throw new Error('API is not available.');
    }

    const orderedProviders = getProviderOrder(status.providers);
    const attempts = [];
    if (orderedProviders.includes('openai')) {
      attempts.push(() => callOpenAiJson(systemPrompt, payload, modelHint, requestOptions));
    }
    if (orderedProviders.includes('anthropic')) {
      attempts.push(() => callAnthropicJson(systemPrompt, payload, modelHint, requestOptions));
    }
    if (orderedProviders.includes('gemini')) {
      attempts.push(() => callGeminiJson(systemPrompt, payload, modelHint, requestOptions));
    }

    let lastError = null;
    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('No API provider call succeeded.');
  }

  async function callApiJson(provider, systemPrompt, payload, modelHint = null, requestOptions = {}) {
    const normalizedProvider = `${provider || ''}`.trim().toLowerCase();
    if (!normalizedProvider) {
      return callPreferredApiJson(systemPrompt, payload, modelHint, requestOptions);
    }

    const status = getApiStatus();
    if (!status.providers.includes(normalizedProvider)) {
      throw new Error(`Requested API provider is not available: ${normalizedProvider}`);
    }

    if (normalizedProvider === 'openai') {
      return callOpenAiJson(systemPrompt, payload, modelHint, requestOptions);
    }
    if (normalizedProvider === 'anthropic') {
      return callAnthropicJson(systemPrompt, payload, modelHint, requestOptions);
    }
    if (normalizedProvider === 'gemini') {
      return callGeminiJson(systemPrompt, payload, modelHint, requestOptions);
    }

    throw new Error(`Unsupported API provider: ${normalizedProvider}`);
  }

  return {
    callOpenAiBlueprintAnalysis,
    callAnthropicBlueprintAnalysis,
    callGeminiBlueprintAnalysis,
    callApiJson,
    callPreferredApiJson,
    getApiStatus,
    verifyApiProviders,
  };
}

module.exports = {
  createApiClient,
};
