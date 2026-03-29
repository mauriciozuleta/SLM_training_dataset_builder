const fs = require('fs/promises');
const path = require('path');
const { createApiClient } = require('../src/main/services/documentGeneration/apiClient');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
  const parsed = {
    runs: 3,
    timeoutMs: 60000,
    output: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--runs' && next) {
      parsed.runs = Math.max(1, Number.parseInt(next, 10) || 3);
      i += 1;
      continue;
    }
    if (key === '--timeout' && next) {
      parsed.timeoutMs = Math.max(5000, Number.parseInt(next, 10) || 60000);
      i += 1;
      continue;
    }
    if (key === '--output' && next) {
      parsed.output = String(next).trim();
      i += 1;
    }
  }

  return parsed;
}

function percentile(values, pct) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[rank];
}

function summarizeRuns(provider, runs) {
  const successful = runs.filter((entry) => entry.ok);
  const failed = runs.filter((entry) => !entry.ok);
  const latencies = successful.map((entry) => entry.elapsedMs);
  const sumLatency = latencies.reduce((sum, value) => sum + value, 0);

  return {
    provider,
    totalRuns: runs.length,
    successCount: successful.length,
    failureCount: failed.length,
    minMs: latencies.length > 0 ? Math.min(...latencies) : 0,
    maxMs: latencies.length > 0 ? Math.max(...latencies) : 0,
    avgMs: latencies.length > 0 ? Number((sumLatency / latencies.length).toFixed(1)) : 0,
    p50Ms: latencies.length > 0 ? percentile(latencies, 50) : 0,
    p95Ms: latencies.length > 0 ? percentile(latencies, 95) : 0,
    lastError: failed.length > 0 ? failed[failed.length - 1].error : '',
  };
}

async function runProviderBenchmarks({ runs, timeoutMs, output }) {
  const env = process.env;
  const api = createApiClient({ env, apiTimeoutMs: timeoutMs });
  const status = api.getApiStatus();
  const providers = Array.isArray(status?.providers) ? status.providers : [];

  if (providers.length === 0) {
    throw new Error('No API providers are configured.');
  }

  const startedAtUtc = new Date().toISOString();
  const detailedRuns = {};

  for (const provider of providers) {
    detailedRuns[provider] = [];
    for (let i = 0; i < runs; i += 1) {
      const started = Date.now();
      try {
        const result = await api.callApiJson(
          provider,
          'Return strict JSON only with shape: {"ok": true, "provider": string, "run": number}.',
          { ping: 'provider-latency-check', provider, run: i + 1 },
          null,
          { timeoutMs }
        );

        const elapsedMs = Date.now() - started;
        detailedRuns[provider].push({
          run: i + 1,
          ok: true,
          elapsedMs,
          modelUsed: `${result?.modelUsed || ''}`.trim(),
          modelVersion: `${result?.modelVersion || ''}`.trim(),
          usage: {
            prompt_tokens: Number(result?.usage?.prompt_tokens || 0),
            completion_tokens: Number(result?.usage?.completion_tokens || 0),
          },
        });
      } catch (error) {
        const elapsedMs = Date.now() - started;
        detailedRuns[provider].push({
          run: i + 1,
          ok: false,
          elapsedMs,
          error: `${error?.message || error || 'Unknown error.'}`,
        });
      }
    }
  }

  const summary = providers.map((provider) => summarizeRuns(provider, detailedRuns[provider]));
  const report = {
    startedAtUtc,
    completedAtUtc: new Date().toISOString(),
    runs,
    timeoutMs,
    providers,
    summary,
    details: detailedRuns,
  };

  const outputPath = output
    ? path.resolve(output)
    : path.join(process.cwd(), 'test_output_files', `provider_latency_report_${Date.now()}.json`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return { report, outputPath };
}

function printSummary(report, outputPath) {
  console.log('Provider benchmark complete.');
  console.log(`Report: ${outputPath}`);
  console.log('');
  console.log('Summary:');

  report.summary.forEach((entry) => {
    const line = [
      `- ${entry.provider}`,
      `runs=${entry.totalRuns}`,
      `success=${entry.successCount}`,
      `fail=${entry.failureCount}`,
      `avg=${entry.avgMs}ms`,
      `p95=${entry.p95Ms}ms`,
      `min=${entry.minMs}ms`,
      `max=${entry.maxMs}ms`,
    ].join(' | ');
    console.log(line);
    if (entry.lastError) {
      console.log(`  lastError: ${entry.lastError}`);
    }
  });
}

(async () => {
  try {
    const args = parseArgs(process.argv.slice(2));
    const { report, outputPath } = await runProviderBenchmarks(args);
    printSummary(report, outputPath);
  } catch (error) {
    console.error(`Benchmark failed: ${error?.message || error}`);
    process.exitCode = 1;
  }
})();
