-- Campo — schema Postgres.
--
-- Duas decisões que valem explicação:
--
-- 1. **JSONB para as listas aninhadas** (itens do pedido, paradas do roteiro,
--    tags, contato falado). Normalizar `paradas` numa tabela filha significaria
--    reescrever as funções de rota, que hoje recebem e devolvem o dia inteiro —
--    e ganharia o quê? Nunca consultamos parada por parada; sempre o dia todo.
--    O volume é de centenas de registros, um usuário. JSONB mantém o modelo de
--    dados igual ao de lib/types.ts, o que faz a migração ser tradução direta.
--
-- 2. **`camelCase` entre aspas** nas colunas. Feio em SQL, mas evita uma camada
--    de conversão nome-a-nome entre o banco e os tipos do TypeScript. Sem isso,
--    todo SELECT precisaria de um mapeamento, e cada campo novo teria dois
--    lugares para esquecer.
--
-- Idempotente: roda a cada partida do servidor sem estragar nada.

CREATE TABLE IF NOT EXISTS clientes (
  id                TEXT PRIMARY KEY,
  nome              TEXT NOT NULL,
  tipo              TEXT NOT NULL,
  cidade            TEXT NOT NULL DEFAULT '',
  bairro            TEXT NOT NULL DEFAULT '',
  endereco          TEXT NOT NULL DEFAULT '',
  telefone          TEXT NOT NULL DEFAULT '',
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  "contatoPrincipal" JSONB,
  funil             TEXT NOT NULL,
  estagio           TEXT NOT NULL,
  status            TEXT NOT NULL,
  "produtosInteresse" JSONB NOT NULL DEFAULT '[]',
  tags              JSONB NOT NULL DEFAULT '[]',
  "criadoEm"        TIMESTAMPTZ NOT NULL,
  "ultimoContatoEm" TIMESTAMPTZ,
  "proximoContatoEm" DATE,
  observacoes       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS clientes_cidade  ON clientes (cidade);
CREATE INDEX IF NOT EXISTS clientes_estagio ON clientes (estagio);
CREATE INDEX IF NOT EXISTS clientes_status  ON clientes (status);

CREATE TABLE IF NOT EXISTS interacoes (
  id                    TEXT PRIMARY KEY,
  "clienteId"           TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  data                  TIMESTAMPTZ NOT NULL,
  tipo                  TEXT NOT NULL,
  "produtosApresentados" JSONB NOT NULL DEFAULT '[]',
  "contatoFalado"       JSONB,
  resultado             TEXT NOT NULL,
  objecao               TEXT,
  "objecaoObs"          TEXT,
  "amostraDeixada"      JSONB,
  "proximoPasso"        TEXT,
  "proximoPassoEm"      DATE,
  encerramento          JSONB,
  notas                 TEXT,
  "duracaoMin"          INTEGER,
  "roteiroId"           TEXT
);

CREATE INDEX IF NOT EXISTS interacoes_cliente ON interacoes ("clienteId");
CREATE INDEX IF NOT EXISTS interacoes_data    ON interacoes (data);

CREATE TABLE IF NOT EXISTS pedidos (
  id               TEXT PRIMARY KEY,
  "clienteId"      TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  data             DATE NOT NULL,
  itens            JSONB NOT NULL DEFAULT '[]',
  -- NUMERIC, não float: dinheiro somado em ponto flutuante acumula centavo.
  "valorTotal"     NUMERIC(12,2) NOT NULL DEFAULT 0,
  "formaPagamento" TEXT NOT NULL,
  "prazoDias"      INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL,
  observacoes      TEXT NOT NULL DEFAULT '',
  "criadoEm"       TIMESTAMPTZ NOT NULL,
  "interacaoId"    TEXT
);

CREATE INDEX IF NOT EXISTS pedidos_cliente ON pedidos ("clienteId");
CREATE INDEX IF NOT EXISTS pedidos_data    ON pedidos (data);

CREATE TABLE IF NOT EXISTS notas (
  id          TEXT PRIMARY KEY,
  texto       TEXT NOT NULL,
  "clienteId" TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  tags        JSONB NOT NULL DEFAULT '[]',
  "criadoEm"  TIMESTAMPTZ NOT NULL,
  resolvida   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS tarefas (
  id             TEXT PRIMARY KEY,
  titulo         TEXT NOT NULL,
  "clienteId"    TEXT REFERENCES clientes(id) ON DELETE CASCADE,
  "vencimentoEm" DATE NOT NULL,
  origem         TEXT NOT NULL,
  concluida      BOOLEAN NOT NULL DEFAULT FALSE,
  "criadoEm"     TIMESTAMPTZ NOT NULL,
  "concluidaEm"  TIMESTAMPTZ,
  "interacaoId"  TEXT
);

CREATE INDEX IF NOT EXISTS tarefas_vencimento ON tarefas ("vencimentoEm");
CREATE INDEX IF NOT EXISTS tarefas_interacao  ON tarefas ("interacaoId");

CREATE TABLE IF NOT EXISTS roteiros (
  id           TEXT PRIMARY KEY,
  semana       INTEGER NOT NULL,
  "diaSemana"  INTEGER NOT NULL,
  data         DATE NOT NULL,
  cidade       TEXT NOT NULL DEFAULT '',
  titulo       TEXT NOT NULL DEFAULT '',
  paradas      JSONB NOT NULL DEFAULT '[]',
  "tardeLivre" BOOLEAN NOT NULL DEFAULT FALSE,
  observacao   TEXT
);

-- Um dia por data é regra do domínio (a tela abre o dia pela data), então é o
-- banco que garante — não a aplicação.
CREATE UNIQUE INDEX IF NOT EXISTS roteiros_data ON roteiros (data);

CREATE TABLE IF NOT EXISTS meta (
  chave TEXT PRIMARY KEY,
  valor JSONB
);
