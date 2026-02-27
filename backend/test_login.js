(async () => {
  const res = await fetch("http://localhost:3000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "vendas@varejosync.com",
      senha: "123456",
    }),
  });

  const data = await res.json().catch(() => ({}));
  console.log("STATUS:", res.status);
  console.log(data);
})();
