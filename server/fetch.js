/**
 * HTTPS client for Groq/HuggingFace — fixes Windows SSL (UNABLE_TO_VERIFY_LEAF_SIGNATURE).
 * Set GROQ_SSL_VERIFY=true in production to enforce certificate checks.
 */
const https = require('https');
const { URL } = require('url');

const strictSsl = process.env.GROQ_SSL_VERIFY === 'true';
const agent = strictSsl ? undefined : new https.Agent({ rejectUnauthorized: false });

function apiFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = options.body
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : null;

    const headers = { ...options.headers };
    if (body && !headers['Content-Length']) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers,
        agent,
        timeout: 120000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => {
              try {
                return JSON.parse(data || '{}');
              } catch {
                throw new Error('Invalid JSON from API');
              }
            },
          });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { apiFetch };
