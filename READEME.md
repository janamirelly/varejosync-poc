
## 📌 Resumo do Projeto

O **VarejoSync** simula o funcionamento básico de uma loja com:

- controle de estoque
- registro de vendas (PDV)
- dashboard gerencial com indicadores operacionais

A aplicação foi construída utilizando:

- **Frontend:** HTML, CSS e JavaScript
- **Backend:** Node.js + Express
- **Banco de dados:** SQLite

---

## ▶ Execução rápida

Backend

```bash
cd backend
npm run dev

Frontend

cd frontend
python -m http.server 5501 --bind 127.0.0.1

Abrir no navegador:

http://127.0.0.1:5501


📌 Visão Geral do Sistema

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

🗂 Estrutura do Projeto

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


🗄 Banco de Dados

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

produto

variacao_produto

estoque

venda

item_venda

documento_fiscal

▶ Execução do Sistema
1️⃣ Iniciar o Backend

No terminal, acessar a pasta backend:

cd backend
npm run dev

A API será iniciada em:

http://localhost:3000
2️⃣ Iniciar o Frontend

Durante os testes foi identificado comportamento instável ao utilizar o Live Server do VSCode, com recarregamento contínuo da aplicação.

Para evitar esse problema, o frontend deve ser executado utilizando um servidor HTTP simples do Python.

No terminal:

cd frontend
python -m http.server 5501 --bind 127.0.0.1

Depois abrir no navegador:

http://127.0.0.1:5501

Observação: em alguns ambientes o terminal pode exibir um endereço IPv6 automático.
Esse endereço pode ser ignorado. Utilize sempre o acesso manual acima.

👥 Usuários de Teste

Para facilitar a demonstração do sistema foram criados três usuários de teste.

Gerente
usuario: gerente@varejosync.com
senha: 123456

Estoquista
usuario: estoque@varejosync.com
senha: 123456
Vendedora

usuario: vendas@varejosync.com
senha: 123456

🔗 Endpoints Principais da API

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

📸 Evidências do Sistema

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

🌐 Landing Page

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

O desenvolvimento técnico principal da aplicação foi realizado por Janayna Mirelly, incluindo:

- modelagem do banco de dados

- implementação da API em Node.js

- desenvolvimento do frontend

- integração entre frontend e backend

- criação dos dashboards

- implementação do fluxo de vendas

- organização das evidências e documentação técnica

- Os demais integrantes contribuíram com apoio em:

- levantamento inicial de requisitos

- revisão da documentação

- organização de materiais para apresentação

- apoio na preparação da entrega final do projeto






