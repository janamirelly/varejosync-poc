(async () => {
  // 1) login
  const loginRes = await fetch("http://localhost:3000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "vendas@varejosync.com",
      senha: "123456",
    }),
  });

  const loginData = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    console.log("LOGIN STATUS:", loginRes.status);
    console.log(loginData);
    return;
  }

  const token = loginData.token || loginData.access_token;
  if (!token) {
    console.log("Login OK mas não veio token:", loginData);
    return;
  }

  // 2) venda
  const res = await fetch("http://localhost:3000/vendas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      forma_pagamento: "PIX",
      itens: [
        {
          id_variacao: 1,
          quantidade: 1,
          preco_unit: 59.9,
          desconto_percent: 0,
        },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));
  console.log("VENDA STATUS:", res.status);
  console.log(data);
})();
