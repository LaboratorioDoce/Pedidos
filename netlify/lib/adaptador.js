module.exports = handler => async event => {
  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = v;
  const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  return new Promise(resolve => {
    let code = 200;
    const res = {
      status(c) { code = c; return res; },
      json(obj) { resolve({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }); return res; }
    };
    Promise.resolve(handler({ method: event.httpMethod, headers, body }, res))
      .catch(e => resolve({ statusCode: 500, body: JSON.stringify({ erro: e.message }) }));
  });
};
