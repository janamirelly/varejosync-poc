window.inicializarTelaDashboardPdv = async function () {
  const btnNovaVenda = document.getElementById("btnNovaVendaDashboard");
  const btnConsultarEstoque = document.getElementById(
    "btnConsultarEstoqueDashboard",
  );

  if (btnNovaVenda) {
    btnNovaVenda.onclick = function () {
      if (typeof loadPage === "function") {
        loadPage("pdv/vendas");
      }
    };
  }

  if (btnConsultarEstoque) {
    btnConsultarEstoque.onclick = function () {
      if (typeof loadPage === "function") {
        loadPage("estoque");
      }
    };
  }

  try {
    const data = await apiGet("/dashboard/pdv");

    const resumo = data?.resumo || {};
    const ultimas = Array.isArray(data?.ultimas_vendas)
      ? data.ultimas_vendas
      : [];
    const produtosMaisVendidos = Array.isArray(data?.produtos_mais_vendidos)
      ? data.produtos_mais_vendidos
      : [];
     const faturamentoSemana = data?.faturamento_semana || {};
     const produtosSemanaRaw = data?.produtos_semana;

     console.log("[PDV] data completo dashboard:", data);
     console.log("[PDV] produtosSemanaRaw:", produtosSemanaRaw);

     const produtosSemana = Array.isArray(produtosSemanaRaw)
       ? produtosSemanaRaw
       : [];
    

    

    const elVendasDia = document.getElementById("vdKpiVendasDia");
    const elFaturamentoDia = document.getElementById("vdKpiFaturamentoDia");
    const elTicketMedio = document.getElementById("vdKpiTicketMedio");
    const elFinalizadas = document.getElementById("vdKpiFinalizadas");
    const elListaUltimas = document.getElementById("vdListaUltimasVendas");
    const elListaProdutos = document.getElementById(
      "vdListaProdutosMaisVendidos",
    );
    const elFaturamentoSemana = document.getElementById("vdFaturamentoSemana");
    const elTicketMedioSemana = document.getElementById("vdTicketMedioSemana");
    const elProdutosSemanaLista = document.getElementById(
      "vdProdutosSemanaLista",
    );
    const elAtualizacaoTopo = document.getElementById("vdAtualizacaoTopo");

    if (elVendasDia) {
      elVendasDia.textContent = String(resumo.vendas_dia || 0);
    }

    if (elFaturamentoDia) {
      elFaturamentoDia.textContent = Number(
        resumo.faturamento_dia || 0,
      ).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }

    if (elTicketMedio) {
      elTicketMedio.textContent = Number(
        resumo.ticket_medio || 0,
      ).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }

    if (elFinalizadas) {
      elFinalizadas.textContent = String(resumo.vendas_finalizadas || 0);
    }

    if (elAtualizacaoTopo) {
      elAtualizacaoTopo.textContent = "Atualizado agora";
    }

    if (elListaUltimas) {
      if (!ultimas.length) {
        elListaUltimas.innerHTML = `
          <div class="vd-list-item">
            <div>
              <strong>Nenhuma venda registrada</strong>
              <span>Sem movimentações recentes.</span>
            </div>
          </div>
        `;
      } else {
        elListaUltimas.innerHTML = ultimas
          .map((venda) => {
            const valor = Number(venda.valor_total || 0).toLocaleString(
              "pt-BR",
              {
                style: "currency",
                currency: "BRL",
              },
            );

            const dataVenda = new Date(venda.criado_em);
            const hora = isNaN(dataVenda.getTime())
              ? "—"
              : dataVenda.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

            const statusRaw = String(venda.status || "").toUpperCase();
            const statusTexto =
              statusRaw === "CONCLUIDA" ? "Finalizada" : "Cancelada";

            const statusClass =
              statusRaw === "CONCLUIDA" ? "status-ok" : "status-warning";

            return `
              <div class="vd-list-item">
                <div>
                  <strong>${hora}</strong>
                  <span>Venda #${venda.id_venda}</span>
                </div>
                <div class="vd-list-right">
                  <strong>${valor}</strong>
                  <span class="status ${statusClass}">${statusTexto}</span>
                </div>
              </div>
            `;
          })
          .join("");
      }
    }

    if (elListaProdutos) {
      if (!produtosMaisVendidos.length) {
        elListaProdutos.innerHTML = `
          <div class="vd-list-item">
            <div>
              <strong>Nenhum produto vendido</strong>
              <span>Sem dados de vendas para exibir.</span>
            </div>
          </div>
        `;
      } else {
        elListaProdutos.innerHTML = produtosMaisVendidos
          .map((item) => {
            return `
              <div class="vd-list-item">
                <div>
                  <strong>${item.produto}</strong>
                  <span>SKU: ${item.sku || "—"}</span>
                </div>
                <strong>${item.unidades} venda(s)</strong>
              </div>
            `;
          })
          .join("");
      }
    }

    if (elFaturamentoSemana) {
      elFaturamentoSemana.textContent = Number(
        faturamentoSemana.valor || 0,
      ).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }

   if (elProdutosSemanaLista) {
     console.log("[PDV] elProdutosSemanaLista existe:", true);
     console.log("[PDV] produtosSemana final:", produtosSemana);

     if (!produtosSemana.length) {
       elProdutosSemanaLista.innerHTML = `<li>Sem dados na semana.</li>`;
     } else {
       const htmlProdutosSemana = produtosSemana
         .map((item) => {
           return `<li>${item.produto} — ${item.unidades} un.</li>`;
         })
         .join("");

       console.log("[PDV] html produtos semana:", htmlProdutosSemana);

       elProdutosSemanaLista.innerHTML = htmlProdutosSemana;
     }
   }

    // if (elProdutosSemanaLista) {
    //   if (!produtosSemana.length) {
    //     elProdutosSemanaLista.innerHTML = `<li>Sem dados na semana.</li>`;
    //   } else {
    //     elProdutosSemanaLista.innerHTML = produtosSemana
    //       .map((item) => `<li>${item.produto} — ${item.unidades} un.</li>`)
    //       .join("");
    //   }
    // }

    if (elTicketMedioSemana) {
      elTicketMedioSemana.textContent = Number(
        faturamentoSemana.ticket_medio || 0,
      ).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }

    console.log("[PDV] dashboard carregada com dados reais");
  } catch (error) {
    console.error("[PDV] erro ao carregar dashboard:", error);
  }
};
