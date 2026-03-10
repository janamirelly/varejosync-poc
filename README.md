## 📌 Resumo do Projeto

O **VarejoSync** simula o funcionamento básico de uma loja com:

- controle de estoque
- registro de vendas (PDV)
- dashboard gerencial com indicadores operacionais

A aplicação foi construída utilizando:

- **Frontend:** HTML, CSS e JavaScript
- **Backend:** Node.js + Express
- **Banco de dados:** SQLite

## 🔗 Links do Projeto

Repositório do projeto  
https://github.com/janamirelly/varejosync-poc.git

Landing page publicada  
 https://janamirelly.github.io/varejosync-poc/
---

## ▶ Execução rápida

### 1️⃣ Iniciar o Backend

```bash
cd backend
npm install
npm run dev

O servidor será iniciado em:

http://localhost:3000

## 2️⃣ Iniciar o Frontend

cd frontend
python -m http.server 5501 --bind 127.0.0.1

Abrir no navegador:

http://127.0.0.1:5501

## Usuários de teste

Gerente
usuario: gerente@varejosync.com
senha: 123456

Estoquista
usuario: estoque@varejosync.com
senha: 123456
Vendedora

usuario: vendas@varejosync.com
senha: 123456

## 📌 Visão Geral do Sistema

O sistema foi estruturado com três perfis de usuário, representando papéis comuns no funcionamento de uma loja.

### Gerente
- dashboard gerencial
- faturamento da semana
- ticket médio
- produtos mais vendidos
- alertas de estoque

### Estoquista
- consulta de estoque
- visualização de variações de produtos (cor e tamanho)
- acompanhamento de alertas de estoque mínimo
- indicadores de cadastro de produtos
- visão geral do estoque disponível

### Vendedora
- registro de vendas no PDV
- consulta rápida de estoque
- visualização das últimas vendas
- acompanhamento de indicadores de vendas do dia

## 🗂 Estrutura do Projeto

A estrutura do repositório foi organizada separando backend, frontend e evidências do sistema.

VAREJOSYNC-POC

backend
 ├ db
 │ ├ schema.sql
 │ ├ migrations.sql
 │ ├ seed.sql
 │ └ patches
 │
 ├ src
 │ ├ controllers
 │ ├ routes
 │ ├ middlewares
 │ ├ utils
 │ └ db
 │    └ database.js
 │
 └ server.js

frontend
 ├ assets
 │ ├ icons
 │ └ users
 │
 ├ css
 ├ js
 ├ pages
 └ index.html

docs
 └ evidencias
    └ prints

landing

tools
 └ evidencias
    └ html

README.md


## 🗄 Banco de Dados

O sistema utiliza SQLite como banco de dados local.

Os scripts responsáveis pela criação e evolução da estrutura estão localizados em:

backend/db
Scripts principais

schema.sql – criação da estrutura inicial do banco

migrations.sql – ajustes estruturais realizados durante o desenvolvimento

seed.sql – dados iniciais utilizados para testes

A conexão com o banco é realizada no módulo:

backend/src/db/database.js

Principais entidades

 - produto
 - variacao_produto
 - estoque
 - venda
 - item_venda
 - documento_fiscal

## 🔗 Endpoints Principais da API

A API foi organizada em rotas REST para atender as funcionalidades do sistema.

Principais endpoints:

GET    /dashboard
GET    /dashboard-pdv
GET    /produtos
GET    /estoque

POST   /vendas
PUT    /vendas
PATCH  /vendas

POST   /fiscal

Esses endpoints são consumidos pelo frontend para alimentar os dashboards e registrar operações de venda.

## 📸 Evidências do Sistema

Durante o desenvolvimento foram registradas evidências da execução do sistema, incluindo:

execução do backend

testes dos endpoints da API

funcionamento do banco SQLite

dashboards do sistema

fluxo de vendas no PDV

consultas de estoque

Os prints utilizados na documentação podem ser encontrados em:

docs/evidencias/prints

Também foram criadas páginas HTML específicas para demonstrar evidências em:

tools/evidencias/html

##🌐 Landing Page

Foi criada uma página simples de apresentação do projeto disponível na pasta:

landing

Essa página apresenta uma visão geral do sistema, suas funcionalidades e tecnologias utilizadas.

### Tecnologias

Frontend
- HTML
- CSS
- JavaScript

Backend
- Node.js
- Express
- Nodemon

Banco de dados
- SQLite

### Ferramentas de Desenvolvimento
- VSCode
- Git
- GitHub
- Postman

👨‍💻 Participação no Projeto

 **Janayna Mirelly Henrique Santos**

Responsável pelo desenvolvimento técnico principal do projeto.

- modelagem do banco de dados

- implementação da API em Node.js

- desenvolvimento do frontend

- integração entre frontend e backend

- criação dos dashboards

- implementação do fluxo de vendas

- organização das evidências e documentação técnica

**Alissa Caetano Santos**
- Participou da etapa inicial de levantamento e organização dos requisitos do sistema.

Atividades:
- levantamento inicial das funcionalidades esperadas para um sistema de gestão de loja
- organização das funcionalidades por perfil de usuário

**Beatriz Silva de Sousa**
- Apoio na definição do fluxo operacional da loja representado na aplicação.

Atividades:
- discussão e validação do fluxo básico de venda no PDV
- apoio na definição das informações necessárias para registro de vendas
- verificação da coerência das informações exibidas nos dashboards

**Claudia Carli**
- Apoio na organização da documentação e materiais do projeto.

Atividades:
- revisão textual da documentação descritiva do sistema
- conferência das descrições das funcionalidades apresentadas no projeto


**Gabriela de Melo Arruda**
- apoio na organização das evidências do sistema.

Atividades:
- seleção e organização dos prints utilizados para demonstrar o funcionamento da aplicação
- revisão das telas capturadas para evidenciar os principais fluxos do sistema

**Julia Maria de Lima Silva**
- Apoio na revisão das funcionalidades implementadas.

Atividades:
- verificação das funcionalidades apresentadas nos dashboards
- revisão das descrições das funcionalidades no README
- apoio na validação das telas utilizadas na demonstração

**Maiara Vitória Deicke**
- Apoio na preparação do material de apresentação do projeto.

Atividades:
- revisão das informações utilizadas na apresentação do sistema
- organização do roteiro de demonstração da aplicação
- apoio na preparação do vídeo de apresentação

**Samara de Paiva Lacerda**
- Apoio na conferência final da entrega.

Atividades:
- revisão da estrutura final do repositório
- conferência dos arquivos incluídos na entrega
- validação dos layouts do frontend.
```
### Colaboração durante o desenvolvimento

Durante o desenvolvimento do sistema, os integrantes do grupo também participaram de momentos de validação da aplicação e discussão de ajustes identificados nos testes.

Contribuições nessas etapas incluíram:

- análise de comportamentos inesperados observados durante os testes do backend e da interface
- discussão de possíveis causas para inconsistências no fluxo de vendas e exibição de dados
- sugestões de ajustes nas regras de funcionamento da aplicação
- apoio na identificação de soluções para correção de bugs encontrados durante o desenvolvimento