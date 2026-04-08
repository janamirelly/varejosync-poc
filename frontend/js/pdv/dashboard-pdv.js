function montarGraficoSemanaCompleto(graficoSemana) {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=dom, 1=seg...
  const diffParaSegunda = (diaSemana + 6) % 7;

  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - diffParaSegunda);
  inicioSemana.setHours(0, 0, 0, 0);

  const mapa = new Map(
    (Array.isArray(graficoSemana) ? graficoSemana : []).map((item) => [
      item.dia,
      Number(item.valor || 0),
    ]),
  );

  const dias = [];
  for (let i = 0; i < 7; i += 1) {
    const data = new Date(inicioSemana);
    data.setDate(inicioSemana.getDate() + i);

    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, "0");
    const dd = String(data.getDate()).padStart(2, "0");
    const chave = `${yyyy}-${mm}-${dd}`;

    dias.push({
      dia: chave,
      valor: mapa.get(chave) || 0,
    });
  }

  return dias;
}

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
    const produtosMaisVendidosDia = Array.isArray(
      data?.produtos_mais_vendidos_dia,
    )
      ? data.produtos_mais_vendidos_dia
      : Array.isArray(data?.produtos_mais_vendidos)
        ? data.produtos_mais_vendidos
        : [];

    const faturamentoSemana = data?.faturamento_semana || {};

    const variacoesVendidasDia = Array.isArray(data?.variacoes_vendidas_dia)
      ? data.variacoes_vendidas_dia
      : [];
    const graficoSemana = Array.isArray(data?.grafico_semana)
      ? data.grafico_semana
      : [];

    const avisos = data?.avisos || {};
    const variacaoPercentual = Number(
      faturamentoSemana.variacao_percentual || 0,
    );

    console.log("[PDV] data completo dashboard:", data);
    console.log(
      "[PDV] produtos_mais_vendidos_dia:",
      data?.produtos_mais_vendidos_dia,
    );
    console.log("[PDV] produtos_mais_vendidos:", data?.produtos_mais_vendidos);
    console.log("[PDV] variacoes_vendidas_dia:", data?.variacoes_vendidas_dia);

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
    const elVariacaoSemana = document.getElementById("vdVariacaoSemana");
    const elGraficoSemana = document.getElementById("vdGraficoSemana");
    const elAvisoReposicao = document.getElementById("vdAvisoReposicao");
    const elAvisoSistema = document.getElementById("vdAvisoSistema");

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
      if (!produtosMaisVendidosDia.length) {
        elListaProdutos.innerHTML = `
      <div class="vd-list-item">
        <div>
          <strong>Nenhum produto vendido</strong>
          <span>Sem dados de vendas para exibir.</span>
        </div>
      </div>
    `;
      } else {
        elListaProdutos.innerHTML = produtosMaisVendidosDia
          .map((item) => {
            const unidades = Number(item.unidades || 0);

            return `
          <div class="vd-list-item">
            <div>
              <strong>${item.produto}</strong>
              <span>Produto com saída no dia</span>
            </div>
            <strong>${unidades} un.</strong>
          </div>
        `;
          })
          .join("");
      }
    }

    if (elFaturamentoSemana) {
      elFaturamentoSemana.textContent = Number(
        resumo.faturamento_dia || 0,
      ).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }

    if (elVariacaoSemana) {
      elVariacaoSemana.textContent = "";
      elVariacaoSemana.classList.remove("is-positive", "is-negative");
    }

    if (elProdutosSemanaLista) {
      if (!produtosMaisVendidosDia.length) {
        elProdutosSemanaLista.innerHTML = `<li>Sem vendas registradas hoje.</li>`;
      } else {
        elProdutosSemanaLista.innerHTML = produtosMaisVendidosDia
          .map((item) => {
            const nomeProduto = item.produto || "Produto";
            const unidades = Number(item.unidades || 0);

            return `<li>${nomeProduto} — ${unidades} un.</li>`;
          })
          .join("");
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
        resumo.ticket_medio || 0,
      ).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }

    if (elGraficoSemana) {
      const graficoCompleto = montarGraficoSemanaCompleto(graficoSemana);
      const maiorValor = Math.max(
        ...graficoCompleto.map((item) => Number(item.valor || 0)),
        1,
      );

      const nomesDias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

      elGraficoSemana.innerHTML = graficoCompleto
        .map((item, index) => {
         const valor = Number(item.valor || 0);
         const altura =
           valor > 0 ? Math.max(34, Math.round((valor / maiorValor) * 112)) : 0;

         const isPeak = valor > 0 && valor === maiorValor;

          return `
        <div class="vd-bar-wrap ${isPeak ? "is-peak" : ""}" title="${item.dia} • ${valor.toLocaleString(
          "pt-BR",
          {
            style: "currency",
            currency: "BRL",
          },
        )}">
          <span
            class="bar bar-dinamica"
            style="height: ${altura}px; opacity: ${valor > 0 ? 1 : 0}"
          ></span>
          <small>${nomesDias[index]}</small>
        </div>
      `;
        })
        .join("");
    }

    if (elAvisoReposicao) {
      const qtdReposicao = Number(avisos.reposicao_necessaria || 0);

      elAvisoReposicao.innerHTML =
        qtdReposicao > 0
          ? `
        <strong>Reposição necessária</strong>
        <span>${qtdReposicao} produto(s) estão com estoque baixo — solicitar apoio ao Estoquista.</span>
      `
          : `
        <strong>Reposição necessária</strong>
        <span>Nenhum item com alerta de estoque no momento.</span>
      `;
    }

    if (elAvisoSistema) {
      const qtdPendencias = Number(avisos.pendencias_sistema || 0);

      elAvisoSistema.innerHTML =
        qtdPendencias > 0
          ? `
        <strong>Sistema</strong>
        <span>${qtdPendencias} ocorrência(s) registrada(s) hoje.</span>
      `
          : `
        <strong>Sistema</strong>
        <span>Nenhuma pendência operacional no momento.</span>
      `;
    }

    console.log("[PDV] dashboard carregada com dados reais");
  } catch (error) {
    console.error("[PDV] erro ao carregar dashboard:", error);
  }
};
