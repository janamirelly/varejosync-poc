$ErrorActionPreference = "Stop"

chcp 65001 | Out-Null
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)



function Wait-Api([string]$baseUrl) {
  Write-Host "Aguardando API em $baseUrl ..."
  for ($i = 1; $i -le 20; $i++) {
    try {
      Invoke-RestMethod -Method GET "$baseUrl/" -TimeoutSec 2 | Out-Null
      Write-Host "✅ API online."
      return
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  throw "API não respondeu em $baseUrl (verifique se o backend está rodando e sem crash)."
}

function Invoke-Retry {
  param(
    [scriptblock]$Call,
    [int]$Max = 6,
    [int]$DelayMs = 600
  )

  for ($i = 1; $i -le $Max; $i++) {
    try {
      return & $Call
    } catch {
      $msg = $_.Exception.Message
      # Só faz retry em erro de conexão/servidor indisponível
      if ($msg -match "Impossível conectar-se ao servidor remoto|Unable to connect|actively refused|EOF|timed out") {
        Start-Sleep -Milliseconds $DelayMs
        continue
      }
      throw
    }
  }
  throw "Falha após $Max tentativas (API instável/offline)."
}


# ===== CONFIG =====
$baseUrl = "http://localhost:3000"
Wait-Api $baseUrl


# Emails seed (do seu schema.sql)
$emailVendedora  = "vendas@varejosync.com"
$emailEstoquista = "estoque@varejosync.com"
$emailGerente    = "gerente@varejosync.com"

# Ajuste para um id_variacao que exista no seu banco
#$idVariacao = 24
# Ajuste para bater com o cadastro do idVariacao (senão cai na regra de divergência)
#$precoUnit = 99.90

# ===== HELPERS =====
function Json($obj, $depth = 10) { $obj | ConvertTo-Json -Depth $depth }

function Login([string]$email) {
  $body = @{ email = $email } | ConvertTo-Json
  Invoke-RestMethod -Method POST "$baseUrl/auth/login" -ContentType "application/json" -Body $body
}

function AuthHeader([string]$token) {
  @{ Authorization = "Bearer $token" }
}

function Section([string]$title) {
  Write-Host "`n===================================================="
  Write-Host $title
  Write-Host "===================================================="
}

# ===== 1) LOGINS =====
Section "1) LOGINS (Vendedora / Estoquista / Gerente)"

Write-Host " Autenticando Vendedora..."
$respVend  = Login $emailVendedora
$tokenVend = $respVend.token
if (-not $tokenVend) { throw "Falha ao gerar token da vendedora." }
Write-Host " Token Vendedora OK | Usuario:" $respVend.usuario.nome "| Perfil:" $respVend.usuario.perfil

Write-Host " Autenticando Estoquista..."
$respEst  = Login $emailEstoquista
$tokenEst = $respEst.token
if (-not $tokenEst) { throw "Falha ao gerar token do estoquista." }
Write-Host " Token Estoquista OK | Usuario:" $respEst.usuario.nome "| Perfil:" $respEst.usuario.perfil

Write-Host " Autenticando Gerente..."
$respGer  = Login $emailGerente
$tokenGer = $respGer.token
if (-not $tokenGer) { throw "Falha ao gerar token do gerente." }
Write-Host " Token Gerente OK | Usuario:" $respGer.usuario.nome "| Perfil:" $respGer.usuario.perfil

# ===== 1.5) DESCOBRIR id_variacao + preco automaticamente =====
Section "1.5) DESCOBRIR id_variacao + preco (auto)"

$idVariacao = $null
$precoUnit  = $null

try {
  # 1) Fonte principal: GET /estoque (vw_estoque_detalhado)
  $estoque = Invoke-Retry { Invoke-RestMethod -Method GET "$baseUrl/estoque" -Headers (AuthHeader $tokenGer) -TimeoutSec 10 }


  $item = $estoque | Where-Object { $_.quantidade -gt 0 } | Select-Object -First 1
  if (-not $item) { $item = $estoque | Select-Object -First 1 }
  if (-not $item) { throw "Sem dados retornados em GET /estoque." }

  $idVariacao = [int]$item.id_variacao
  $precoUnit  = [double]$item.preco

  Write-Host "Fonte: GET /estoque"
  Write-Host "Usando id_variacao=$idVariacao | sku=$($item.sku) | preco=$precoUnit | qtd=$($item.quantidade)"
}
catch {
  Write-Host " Falhou GET /estoque. Fallback para GET /produtos e GET /produtos/:id/variacoes"
  Write-Host "Motivo:" $_.Exception.Message

  # 2) Fallback: pega 1 produto e busca variações dele
  $produtos = Invoke-Retry { Invoke-RestMethod -Method GET "$baseUrl/produtos" -Headers (AuthHeader $tokenGer) -TimeoutSec 10 }

  $p = $produtos | Select-Object -First 1
  if (-not $p) { throw "Sem produtos retornados em GET /produtos." }

  $vars     = Invoke-Retry { Invoke-RestMethod -Method GET "$baseUrl/produtos/$($p.id_produto)/variacoes" -Headers (AuthHeader $tokenGer) -TimeoutSec 10 }

  $v = $vars | Where-Object { $_.ativo -eq 1 } | Select-Object -First 1
  if (-not $v) { $v = $vars | Select-Object -First 1 }
  if (-not $v) { throw "Sem variações retornadas em GET /produtos/$($p.id_produto)/variacoes." }

  $idVariacao = [int]$v.id_variacao
  $precoUnit  = [double]$v.preco

  Write-Host "Fonte: GET /produtos/$($p.id_produto)/variacoes"
  Write-Host "Usando id_variacao=$idVariacao | sku=$($v.sku) | preco=$precoUnit"
}

if (-not $idVariacao -or $precoUnit -eq $null) {
  throw "Falha ao descobrir id_variacao/preco automaticamente."
}



# ===== 2) TESTE: MOVIMENTACAO BLOQUEADA (Vendedora) =====
Section "2) TESTE: MOVIMENTACAO BLOQUEADA (Vendedora -> POST /movimentacoes)"

try {
  $movBodyVend = @{
    id_variacao = $idVariacao
    tipo        = "ENTRADA"
    quantidade  = 1
    observacao  = "Teste bloqueio (vendedora)"
  } | ConvertTo-Json -Depth 5

  Invoke-RestMethod -Method POST "$baseUrl/estoque/movimentacoes" `
    -Headers (AuthHeader $tokenVend) `
    -ContentType "application/json" `
    -Body $movBodyVend | Out-Null

  Write-Host " ERRO: era para bloquear, mas passou."
} catch {
  Write-Host " OK (bloqueado como esperado)."
  Write-Host "Mensagem:" $_.Exception.Message
}

# ===== 3) TESTE: MOVIMENTACAO PERMITIDA (Estoquista) =====
Section "3) TESTE: MOVIMENTACAO PERMITIDA (Estoquista -> POST /movimentacoes)"

$movBodyEst = @{
  id_variacao = $idVariacao
  tipo        = "ENTRADA"
  quantidade  = 1
  observacao  = "Reposição (estoquista) - teste PI"
} | ConvertTo-Json -Depth 5

$respMov = Invoke-RestMethod -Method POST "$baseUrl/estoque/movimentacoes" `
  -Headers (AuthHeader $tokenEst) `
  -ContentType "application/json" `
  -Body $movBodyEst

Write-Host " Movimentação registrada (Estoquista)."
Write-Host (Json $respMov 10)

# ===== 4) VENDA (Vendedora) =====
Section "4) VENDA (Vendedora -> POST /vendas)"

$vendaBody = @{
  forma_pagamento = "CREDITO"
  itens = @(
    @{ id_variacao = $idVariacao; quantidade = 1; preco_unit = $precoUnit }
  )
} | ConvertTo-Json -Depth 6

$respVenda = Invoke-Retry {
  Invoke-RestMethod -Method POST "$baseUrl/vendas" `
    -Headers (AuthHeader $tokenVend) `
    -ContentType "application/json" `
    -Body $vendaBody `
    -TimeoutSec 10
}


$idVenda = $respVenda.id_venda
Write-Host " Venda criada OK. id_venda = $idVenda"
Write-Host (Json $respVenda 10)

# ===== 4.5) FISCAL: EMITIR (Gerente) =====
Section "4.5) FISCAL: EMITIR (Gerente -> POST /fiscal/emitir/:id_venda)"

$respFiscal = Invoke-RestMethod -Method POST "$baseUrl/fiscal/emitir/$idVenda" `
  -Headers (AuthHeader $tokenGer)

if (-not $respFiscal.ok) { throw "Falha ao emitir fiscal. Resposta: $(Json $respFiscal 10)" }

Write-Host " Fiscal emitido OK."
Write-Host (Json $respFiscal 10)

# ===== 4.6) BLOQUEIO: CANCELAR VENDA COM FISCAL EMITIDA (deve BLOQUEAR) =====
Section "4.6) BLOQUEIO: Cancelar venda com fiscal EMITIDA (deve dar 403)"

try {
  $cancelBody2 = @{ motivo = "Tentativa cancelar com fiscal emitida" } | ConvertTo-Json
  Invoke-RestMethod -Method PUT "$baseUrl/vendas/$idVenda/cancelar" `
    -Headers (AuthHeader $tokenVend) `
    -ContentType "application/json" `
    -Body $cancelBody2 | Out-Null

  Write-Host " ERRO: era para bloquear, mas passou."
} catch {
  # tenta extrair HTTP status (PowerShell 7+ geralmente tem)
  $statusCode = $null
  try { $statusCode = $_.Exception.Response.StatusCode.value__ } catch {}

  if ($statusCode -and $statusCode -ne 403) {
    throw "Era esperado 403. Veio $statusCode. Mensagem: $($_.Exception.Message)"
  }

  Write-Host " OK (bloqueado como esperado)."
  Write-Host "Mensagem:" $_.Exception.Message
}

# ===== 4.7) FISCAL: CANCELAR (Gerente) =====
Section "4.7) FISCAL: CANCELAR (Gerente -> PUT /fiscal/cancelar/:id_venda)"

$bodyCancelFiscal = @{ motivo = "Cancelamento fiscal (teste PI)" } | ConvertTo-Json

$respCancelFiscal = Invoke-RestMethod -Method PUT "$baseUrl/fiscal/cancelar/$idVenda" `
  -Headers (AuthHeader $tokenGer) `
  -ContentType "application/json" `
  -Body $bodyCancelFiscal

if (-not $respCancelFiscal.ok) { throw "Falha ao cancelar fiscal. Resposta: $(Json $respCancelFiscal 10)" }

Write-Host " Fiscal cancelado OK."
Write-Host (Json $respCancelFiscal 10)

# ===== X) RELATORIO: FISCAL (Gerente) =====
Section "X) RELATORIO: FISCAL (Gerente -> GET /relatorios/fiscal)"

$inicio = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
$fim    = (Get-Date).ToString("yyyy-MM-dd")

$respRelFiscal = Invoke-RestMethod -Method GET "$baseUrl/relatorios/fiscal?inicio=$inicio&fim=$fim" `
  -Headers (AuthHeader $tokenGer)

Write-Host " Relatório fiscal (período):"
Write-Host (Json $respRelFiscal 10)

# ===== 4.75) DEVOLUÇÃO (Opção B) - FIM A FIM =====
Section "4.75) DEVOLUÇÃO (Opção B): bloquear com fiscal EMITIDA, permitir após fiscal CANCELADA"

# 1) Criar uma NOVA venda só para teste de devolução 
$vendaBodyDev = @"
{
  "forma_pagamento": "PIX",
  "itens": [
    { "id_variacao": $idVariacao, "quantidade": 1, "preco_unit": $precoUnit }
  ]
}
"@

$respVendaDev = Invoke-Retry {
  Invoke-RestMethod -Method POST "$baseUrl/vendas" `
    -Headers (AuthHeader $tokenVend) `
    -ContentType "application/json" `
    -Body $vendaBodyDev `
    -TimeoutSec 10
}

$idVendaDev = $respVendaDev.id_venda
Write-Host " Venda (devolução) criada OK. id_venda = $idVendaDev"
Write-Host (Json $respVendaDev 10)

# 2) Emitir fiscal (gerente)
$respFiscalDev = Invoke-RestMethod -Method POST "$baseUrl/fiscal/emitir/$idVendaDev" `
  -Headers (AuthHeader $tokenGer)

if (-not $respFiscalDev.ok) { throw "Falha ao emitir fiscal (devolução). Resposta: $(Json $respFiscalDev 10)" }

Write-Host " Fiscal (devolução) emitido OK."
Write-Host (Json $respFiscalDev 10)

# 3) Tentar devolver com fiscal EMITIDA -> deve dar 403
try {
  $bodyDevolverBloq = @{ motivo = "Tentativa devolução com fiscal emitida (teste PI)" } | ConvertTo-Json
  Invoke-RestMethod -Method PUT "$baseUrl/vendas/$idVendaDev/devolver" `
    -Headers (AuthHeader $tokenVend) `
    -ContentType "application/json" `
    -Body $bodyDevolverBloq | Out-Null

  Write-Host " ERRO: era para bloquear devolução com fiscal EMITIDA, mas passou." -ForegroundColor Red
} catch {
  $statusCode = $null
  try { $statusCode = $_.Exception.Response.StatusCode.value__ } catch {}

  if ($statusCode -and $statusCode -ne 403) {
    throw "Era esperado 403 na devolução com fiscal EMITIDA. Veio $statusCode. Mensagem: $($_.Exception.Message)"
  }

  Write-Host " OK (devolução bloqueada como esperado com fiscal EMITIDA)." -ForegroundColor Green
  Write-Host "Mensagem:" $_.Exception.Message
}

# 4) Cancelar fiscal (gerente)
$bodyCancelFiscalDev = @{ motivo = "Cancelamento fiscal para permitir devolução (teste PI)" } | ConvertTo-Json

$respCancelFiscalDev = Invoke-RestMethod -Method PUT "$baseUrl/fiscal/cancelar/$idVendaDev" `
  -Headers (AuthHeader $tokenGer) `
  -ContentType "application/json" `
  -Body $bodyCancelFiscalDev

if (-not $respCancelFiscalDev.ok) { throw "Falha ao cancelar fiscal (devolução). Resposta: $(Json $respCancelFiscalDev 10)" }

Write-Host " Fiscal (devolução) cancelado OK."
Write-Host (Json $respCancelFiscalDev 10)


# ===== 4.8) AGORA DEVE PERMITIR: CANCELAR VENDA (após cancelar fiscal) =====
Section "4.8) AGORA DEVE PERMITIR: Cancelar venda após fiscal CANCELADA"

$cancelBodyFinal = @{ motivo = "Cancelamento após fiscal cancelado (teste PI)" } | ConvertTo-Json

$respCancelVenda = Invoke-RestMethod -Method PUT "$baseUrl/vendas/$idVenda/cancelar" `
  -Headers (AuthHeader $tokenVend) `
  -ContentType "application/json" `
  -Body $cancelBodyFinal

Write-Host " Cancelamento da venda OK (após fiscal cancelada)."
Write-Host (Json $respCancelVenda 10)

# 5) AGORA DEVE PERMITIR: DEVOLVER VENDA
Section "4.76) DEVOLVER VENDA após fiscal CANCELADA"

$bodyDevolverOk = @{ motivo = "Cliente devolveu produto (teste PI)" } | ConvertTo-Json

$respDevolverOk = Invoke-RestMethod -Method PUT "$baseUrl/vendas/$idVendaDev/devolver" `
  -Headers (AuthHeader $tokenVend) `
  -ContentType "application/json" `
  -Body $bodyDevolverOk

if (-not $respDevolverOk.ok) {
  throw "Falha ao devolver venda após fiscal cancelada. Resposta: $(Json $respDevolverOk 10)"
}

Write-Host " Devolução realizada com sucesso."
Write-Host (Json $respDevolverOk 10)

# 6) Validar rastreabilidade da venda devolvida
Section "4.77) RASTREABILIDADE DA VENDA DEVOLVIDA"

$respRastDev = Invoke-RestMethod -Method GET "$baseUrl/relatorios/rastreabilidade?id_venda=$idVendaDev" `
  -Headers (AuthHeader $tokenGer)

Write-Host " Rastreabilidade da venda devolvida:"
Write-Host (Json $respRastDev 12)



# ===== 7) RELATORIO: MOVIMENTACOES (Gerente) =====
Section "7) RELATORIO: MOVIMENTACOES (Gerente -> GET /relatorios/movimentacoes)"

$inicio = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
$fim    = (Get-Date).ToString("yyyy-MM-dd")

$respRelMov = Invoke-RestMethod -Method GET "$baseUrl/relatorios/movimentacoes?inicio=$inicio&fim=$fim" `
  -Headers (AuthHeader $tokenGer)

Write-Host " Relatório de movimentações (por dia/usuário):"
Write-Host (Json $respRelMov 10)

# ===== 8) RASTREABILIDADE (Gerente) =====
Section "8) RASTREABILIDADE (Gerente -> GET /relatorios/rastreabilidade?id_venda=...)"

$respRast = Invoke-RestMethod -Method GET "$baseUrl/relatorios/rastreabilidade?id_venda=$idVenda" `
  -Headers (AuthHeader $tokenGer)

Write-Host " Rastreabilidade da venda:"
Write-Host (Json $respRast 12)

# ===== 9) NOTA FINAL =====
Section "9) AUDITORIA (manual no SQLite)"

Write-Host "Se você não tem rota de auditoria, rode no SQLite:"
Write-Host "SELECT id_auditoria, criado_em, id_usuario, acao, recurso FROM auditoria ORDER BY id_auditoria DESC LIMIT 10;"
Write-Host "`n RUN-ALL FINALIZADO COM SUCESSO."
