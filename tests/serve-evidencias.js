async function doFetch(method, path, body) {
  const url = urlFor(path);
  const headers = { "Content-Type": "application/json", ...getAuthHeaders() };
  const opt = { method, headers };
  if (body) opt.body = JSON.stringify(body);

  try {
    const r = await fetch(url, opt);
    const status = r.status;

    let json;
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      json = await r.json();
    } else {
      const t = await r.text();
      json = { raw: t.slice(0, 2000) };
    }
    return { url, status, json };
  } catch (e) {
    // ✅ Mostra o erro na tela e não “pisca”
    return {
      url,
      status: 0,
      json: { erro: "FALHA_FETCH", mensagem: String(e) },
    };
  }
}
