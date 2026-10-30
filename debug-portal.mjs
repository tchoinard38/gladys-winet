// Debug étape par étape du portail (ne logue rien de secret).
const UA = 'Mozilla/5.0 (X11; Linux x86_64) thermorossi-gladys/1.0';
const jar = new Map();
function cookieHeader() { return [...jar].map(([k, v]) => `${k}=${v}`).join('; '); }
function apply(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(';')[0];
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const r1 = await fetch('https://thermorossi.cloudwinet.it/', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
apply(r1);
const html = await r1.text();
console.log('GET /:', r1.status, 'cookies:', [...jar.keys()], 'hidden inputs:', (html.match(/type="hidden"/g) ?? []).length, 'len', html.length);

const r2 = await fetch('https://thermorossi.cloudwinet.it/Login.aspx/VerifyLogin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': UA, Cookie: cookieHeader(), Referer: 'https://thermorossi.cloudwinet.it/', Origin: 'https://thermorossi.cloudwinet.it' },
  body: JSON.stringify({ username: process.env.WINET_USER, password: process.env.WINET_PASS }),
  signal: AbortSignal.timeout(20000),
});
apply(r2);
const body = await r2.text();
console.log('POST VerifyLogin:', r2.status, 'ctype:', r2.headers.get('content-type'));
console.log('body head:', body.slice(0, 300).replace(/\s+/g, ' '));
