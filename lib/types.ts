/**
 * Campo — modelo de dados.
 *
 * Convenção: cada enumeração é declarada uma única vez como array `as const`.
 * O tipo é derivado do array e o rótulo em pt-BR é um `Record` exaustivo sobre
 * o tipo. Assim, acrescentar um valor ao array quebra a compilação até que o
 * rótulo correspondente exista — os três nunca saem de sincronia.
 */

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

/** Momento exato, ISO 8601 completo. Ex.: "2026-08-03T13:45:00.000Z". */
export type Instante = string;

/**
 * Data civil local, sem hora, em "AAAA-MM-DD".
 * Usada em tudo que é "dia" e não "momento": vencimento de tarefa, retorno de
 * amostra, data do roteiro. Ordena por string exatamente como ordena no tempo,
 * e não sofre com fuso horário — que é a razão de não guardarmos `Date` aqui.
 */
export type DataCivil = string;

/** Segunda a sexta. O roteiro não prevê fim de semana. */
export const DIAS_SEMANA = [1, 2, 3, 4, 5] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const LABEL_DIA_SEMANA: Record<DiaSemana, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
};

export const LABEL_DIA_SEMANA_CURTO: Record<DiaSemana, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
};

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

export const TIPOS_CLIENTE = [
  "hospital",
  "loja_medico_hospitalar",
  "petshop",
  "clinica_veterinaria",
  "casa_racao",
  "distribuidor",
] as const;
export type TipoCliente = (typeof TIPOS_CLIENTE)[number];

export const LABEL_TIPO_CLIENTE: Record<TipoCliente, string> = {
  hospital: "Hospital",
  loja_medico_hospitalar: "Loja médico-hospitalar",
  petshop: "Petshop",
  clinica_veterinaria: "Clínica veterinária",
  casa_racao: "Casa de rações",
  distribuidor: "Distribuidor",
};

/** Rótulo curto para caber no card e na legenda do mapa. */
export const LABEL_TIPO_CLIENTE_CURTO: Record<TipoCliente, string> = {
  hospital: "Hospital",
  loja_medico_hospitalar: "Méd-hosp",
  petshop: "Petshop",
  clinica_veterinaria: "Vet",
  casa_racao: "Rações",
  distribuidor: "Distrib.",
};

/** Cor por tipo — marcadores do mapa e etiquetas. Espelha as vars de globals.css. */
export const COR_TIPO_CLIENTE: Record<TipoCliente, string> = {
  hospital: "#a30d18",
  loja_medico_hospitalar: "#6b21a8",
  petshop: "#0f6b33",
  clinica_veterinaria: "#0e6f7a",
  casa_racao: "#8a5a00",
  distribuidor: "#3730a3",
};

/** Ícone (emoji) por tipo — legível a um metro de distância, custo zero. */
export const ICONE_TIPO_CLIENTE: Record<TipoCliente, string> = {
  hospital: "🏥",
  loja_medico_hospitalar: "🩺",
  petshop: "🐾",
  clinica_veterinaria: "🐕",
  casa_racao: "🌾",
  distribuidor: "📦",
};

// ---------------------------------------------------------------------------
// Funis (P5 — dois funis, não um)
// ---------------------------------------------------------------------------

export const FUNIS = ["institucional", "varejo"] as const;
export type Funil = (typeof FUNIS)[number];

export const LABEL_FUNIL: Record<Funil, string> = {
  institucional: "Institucional",
  varejo: "Varejo",
};

export const ESTAGIOS_INSTITUCIONAL = [
  "prospect",
  "mapeado",
  "demo_agendada",
  "demo_realizada",
  "amostra_em_teste",
  "proposta",
  "cliente",
  "perdido",
] as const;
export type EstagioInstitucional = (typeof ESTAGIOS_INSTITUCIONAL)[number];

export const ESTAGIOS_VAREJO = [
  "prospect",
  "visitado",
  "material_deixado",
  "primeiro_pedido",
  "recompra",
  "perdido",
] as const;
export type EstagioVarejo = (typeof ESTAGIOS_VAREJO)[number];

export type Estagio = EstagioInstitucional | EstagioVarejo;

export const LABEL_ESTAGIO: Record<Estagio, string> = {
  prospect: "Prospect",
  mapeado: "Decisor mapeado",
  demo_agendada: "Demo agendada",
  demo_realizada: "Demo realizada",
  amostra_em_teste: "Amostra em teste",
  proposta: "Proposta",
  cliente: "Cliente",
  visitado: "Visitado",
  material_deixado: "Material deixado",
  primeiro_pedido: "1º pedido",
  recompra: "Recompra",
  perdido: "Perdido",
};

/**
 * O funil é derivado do tipo, nunca digitado (seção 5).
 * Hospital é o único caso institucional; todo o resto é varejo.
 */
export function funilDoTipo(tipo: TipoCliente): Funil {
  return tipo === "hospital" ? "institucional" : "varejo";
}

/** Colunas do Kanban — mudam conforme o funil (critério de aceite). */
export function estagiosDoFunil(funil: Funil): readonly Estagio[] {
  return funil === "institucional" ? ESTAGIOS_INSTITUCIONAL : ESTAGIOS_VAREJO;
}

/** Posição do estágio dentro do seu funil. -1 se não pertencer. */
export function ordemDoEstagio(funil: Funil, estagio: Estagio): number {
  return estagiosDoFunil(funil).indexOf(estagio);
}

/**
 * Estágios considerados "quentes": pipeline vivo que apodrece se ficar parado.
 * Alimentam a prioridade de entrada na rota (seção 7).
 */
export const ESTAGIOS_QUENTES: readonly Estagio[] = [
  "demo_realizada",
  "amostra_em_teste",
  "proposta",
];

export const STATUS_CLIENTE = ["ativo", "sem_potencial", "perdido"] as const;
export type StatusCliente = (typeof STATUS_CLIENTE)[number];

export const LABEL_STATUS_CLIENTE: Record<StatusCliente, string> = {
  ativo: "Ativo",
  sem_potencial: "Sem potencial",
  perdido: "Perdido",
};

export interface Contato {
  nome: string;
  cargo: string;
  telefone: string;
}

export interface Cliente {
  id: string;
  nome: string;
  tipo: TipoCliente;
  cidade: string;
  bairro: string;
  endereco: string;
  telefone: string;
  /** Opcionais: cliente cadastrado na rua pode não ter GPS na hora. Sem elas,
   *  o app esconde Navegar e deixa o cliente fora do mapa e da ordenação
   *  por proximidade — nunca inventa uma posição. */
  lat?: number;
  lng?: number;
  contatoPrincipal?: Contato;
  /** Derivado de `tipo` — ver `funilDoTipo`. Persistido para poder ser indexado. */
  funil: Funil;
  estagio: Estagio;
  status: StatusCliente;
  produtosInteresse: Produto[];
  tags: string[];
  criadoEm: Instante;
  ultimoContatoEm?: Instante;
  proximoContatoEm?: DataCivil;
  observacoes: string;
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

export const PRODUTOS = [
  "us_sache",
  "us_ssi",
  "us_capsula",
  "us_capsula_bag",
  "xoxixi_250g",
  "xoxixi_1kg",
] as const;
export type Produto = (typeof PRODUTOS)[number];

export const LABEL_PRODUTO: Record<Produto, string> = {
  us_sache: "US Sachê 15g",
  us_ssi: "US SSI 250g",
  us_capsula: "US Cápsula",
  us_capsula_bag: "US Cápsula-Bag",
  xoxixi_250g: "Xô Xixi 250g",
  xoxixi_1kg: "Xô Xixi 1kg",
};

export const LINHAS_PRODUTO = ["gerais", "xoxixi"] as const;
export type LinhaProduto = (typeof LINHAS_PRODUTO)[number];

export const LABEL_LINHA_PRODUTO: Record<LinhaProduto, string> = {
  gerais: "Gerais — solidificadores",
  xoxixi: "Xô Xixi — pet",
};

export const LINHA_DO_PRODUTO: Record<Produto, LinhaProduto> = {
  us_sache: "gerais",
  us_ssi: "gerais",
  us_capsula: "gerais",
  us_capsula_bag: "gerais",
  xoxixi_250g: "xoxixi",
  xoxixi_1kg: "xoxixi",
};

/**
 * Produtos que fazem sentido oferecer a cada tipo de cliente.
 * Só filtra a grade de seleção para reduzir toques — não bloqueia nada.
 */
export const PRODUTOS_POR_TIPO: Record<TipoCliente, readonly Produto[]> = {
  hospital: ["us_ssi", "us_sache", "us_capsula", "us_capsula_bag"],
  loja_medico_hospitalar: ["us_capsula_bag", "us_ssi", "us_sache"],
  petshop: ["xoxixi_250g", "xoxixi_1kg"],
  clinica_veterinaria: ["xoxixi_250g", "xoxixi_1kg"],
  casa_racao: ["xoxixi_1kg", "xoxixi_250g"],
  distribuidor: PRODUTOS,
};

// ---------------------------------------------------------------------------
// Interação
// ---------------------------------------------------------------------------

export const TIPOS_INTERACAO = [
  "visita",
  "ligacao",
  "whatsapp",
  "demonstracao",
  "entrega",
] as const;
export type TipoInteracao = (typeof TIPOS_INTERACAO)[number];

export const LABEL_TIPO_INTERACAO: Record<TipoInteracao, string> = {
  visita: "Visita",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  demonstracao: "Demonstração",
  entrega: "Entrega",
};

export const RESULTADOS = [
  "pedido",
  "interesse",
  "retorno_agendado",
  "sem_interesse",
  "nao_encontrou_decisor",
  "estabelecimento_fechado",
] as const;
export type ResultadoInteracao = (typeof RESULTADOS)[number];

/** Rótulos como aparecem na grade da etapa 1 do registro (seção 6.2). */
export const LABEL_RESULTADO: Record<ResultadoInteracao, string> = {
  pedido: "Pedido",
  interesse: "Interesse",
  retorno_agendado: "Voltar depois",
  sem_interesse: "Sem interesse",
  nao_encontrou_decisor: "Não achei o decisor",
  estabelecimento_fechado: "Fechado",
};

export const ICONE_RESULTADO: Record<ResultadoInteracao, string> = {
  pedido: "💰",
  interesse: "👍",
  retorno_agendado: "🔁",
  sem_interesse: "👎",
  nao_encontrou_decisor: "🕵️",
  estabelecimento_fechado: "🚪",
};

/** Resultado que dispensa a etapa 2 (objeção) — não houve trava. */
export function pulaObjecao(resultado: ResultadoInteracao): boolean {
  return resultado === "pedido";
}

// --- Objeções (P6 — taxonomia fechada) ---

export const OBJECOES = [
  "preco",
  "sem_verba",
  "nao_e_prioridade",
  "ja_resolve_de_outro_jeito",
  "precisa_aprovacao_superior",
  "precisa_aprovacao_ccih",
  "desconfia_do_produto",
  "sem_espaco_prateleira",
  "estoque_cheio",
  "compra_so_de_distribuidor",
  "outra",
] as const;
export type Objecao = (typeof OBJECOES)[number];

export const LABEL_OBJECAO: Record<Objecao, string> = {
  preco: "Preço",
  sem_verba: "Sem verba",
  nao_e_prioridade: "Não é prioridade",
  ja_resolve_de_outro_jeito: "Já resolve de outro jeito",
  precisa_aprovacao_superior: "Precisa aprovação superior",
  precisa_aprovacao_ccih: "Precisa aprovação da CCIH",
  desconfia_do_produto: "Desconfia do produto",
  sem_espaco_prateleira: "Sem espaço na prateleira",
  estoque_cheio: "Estoque cheio",
  compra_so_de_distribuidor: "Compra só de distribuidor",
  outra: "Outra",
};

/**
 * Objeções que só aparecem em um dos funis. As demais valem para os dois.
 * Serve para encurtar a grade da etapa 2 — menos toque, menos leitura.
 */
export const OBJECOES_POR_FUNIL: Record<Funil, readonly Objecao[]> = {
  institucional: [
    "sem_verba",
    "precisa_aprovacao_ccih",
    "precisa_aprovacao_superior",
    "nao_e_prioridade",
    "ja_resolve_de_outro_jeito",
    "desconfia_do_produto",
    "preco",
    "compra_so_de_distribuidor",
    "outra",
  ],
  varejo: [
    "preco",
    "sem_espaco_prateleira",
    "estoque_cheio",
    "compra_so_de_distribuidor",
    "ja_resolve_de_outro_jeito",
    "desconfia_do_produto",
    "nao_e_prioridade",
    "precisa_aprovacao_superior",
    "outra",
  ],
};

export interface AmostraDeixada {
  produto: Produto;
  qtd: number;
  /** Default D+7, configurável (P3). Vira tarefa automaticamente. */
  retornoEm: DataCivil;
}

/**
 * Único escape legítimo de P2. Quando presente, dispensa próximo passo —
 * e encerra o cliente com motivo registrado.
 */
export interface EncerramentoCliente {
  status: Extract<StatusCliente, "sem_potencial" | "perdido">;
  motivo: string;
}

export interface Interacao {
  id: string;
  clienteId: string;
  data: Instante;
  tipo: TipoInteracao;
  produtosApresentados: Produto[];
  contatoFalado?: { nome: string; cargo: string };
  resultado: ResultadoInteracao;
  objecao?: Objecao;
  objecaoObs?: string;
  amostraDeixada?: AmostraDeixada;
  /** Obrigatório salvo se `encerramento` estiver preenchido — ver P2 em db.ts. */
  proximoPasso?: string;
  proximoPassoEm?: DataCivil;
  encerramento?: EncerramentoCliente;
  notas?: string;
  duracaoMin?: number;
  /** Preenchido quando o registro nasceu de uma parada do roteiro. */
  roteiroId?: string;
}

// ---------------------------------------------------------------------------
// Pedido
// ---------------------------------------------------------------------------

export const STATUS_PEDIDO = [
  "pendente",
  "faturado",
  "entregue",
  "cancelado",
] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const LABEL_STATUS_PEDIDO: Record<StatusPedido, string> = {
  pendente: "Pendente",
  faturado: "Faturado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

/** Não consta da especificação; enum fechado para manter o dado analisável. */
export const FORMAS_PAGAMENTO = [
  "pix",
  "boleto",
  "dinheiro",
  "cartao",
  "faturado",
] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const LABEL_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "Pix",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  faturado: "Faturado a prazo",
};

export interface ItemPedido {
  produto: Produto;
  quantidade: number;
  precoUnitario: number;
  /** Percentual, 0 a 100. */
  desconto: number;
}

export interface Pedido {
  id: string;
  clienteId: string;
  data: DataCivil;
  itens: ItemPedido[];
  valorTotal: number;
  formaPagamento: FormaPagamento;
  prazoDias: number;
  status: StatusPedido;
  observacoes: string;
  criadoEm: Instante;
  /** Preenchido quando o pedido nasceu de uma visita registrada. */
  interacaoId?: string;
}

/** Valor de um item já com desconto aplicado. Fonte única do cálculo. */
export function valorItem(item: ItemPedido): number {
  const bruto = item.quantidade * item.precoUnitario;
  return bruto * (1 - item.desconto / 100);
}

export function valorPedido(itens: ItemPedido[]): number {
  // Arredonda no total, não item a item, para não acumular centavos.
  return Math.round(itens.reduce((s, i) => s + valorItem(i), 0) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Nota
// ---------------------------------------------------------------------------

export interface Nota {
  id: string;
  texto: string;
  clienteId?: string;
  tags: string[];
  criadoEm: Instante;
  resolvida: boolean;
}

// ---------------------------------------------------------------------------
// Tarefa
// ---------------------------------------------------------------------------

export const ORIGENS_TAREFA = [
  "manual",
  "proximo_passo",
  "retorno_amostra",
] as const;
export type OrigemTarefa = (typeof ORIGENS_TAREFA)[number];

export const LABEL_ORIGEM_TAREFA: Record<OrigemTarefa, string> = {
  manual: "Manual",
  proximo_passo: "Próximo passo",
  retorno_amostra: "Retorno de amostra",
};

export interface Tarefa {
  id: string;
  titulo: string;
  clienteId?: string;
  vencimentoEm: DataCivil;
  origem: OrigemTarefa;
  concluida: boolean;
  criadoEm: Instante;
  concluidaEm?: Instante;
  /** Interação que gerou a tarefa (P2 e P3). */
  interacaoId?: string;
}

// ---------------------------------------------------------------------------
// Roteiro
// ---------------------------------------------------------------------------

export interface ParadaRoteiro {
  ordem: number;
  clienteId: string;
  /** "HH:MM" em 24h. Sugestão, não compromisso. */
  horarioSugerido: string;
  objetivo: string;
  concluida: boolean;
  interacaoId?: string;
}

export interface Roteiro {
  id: string;
  /** 1 a 4 no plano inicial; segue crescendo a cada "gerar semana seguinte". */
  semana: number;
  diaSemana: DiaSemana;
  data: DataCivil;
  cidade: string;
  titulo: string;
  paradas: ParadaRoteiro[];
  /** Sexta à tarde é reservada para follow-up telefônico (seção 7). */
  tardeLivre: boolean;
  observacao?: string;
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

/**
 * Ajustes que o usuário pode mudar. Tabela chave-valor para não precisar de
 * migração de schema a cada novo ajuste.
 */
export interface Config {
  diasRetornoAmostra: number;
  maxParadasPorDia: number;
  /** Percentual da rota reservado a follow-up a partir da semana 2. */
  percentualFollowUp: number;
  diasSemContatoAlerta: number;
  cidadeBase: string;
  /** Último preço praticado por produto — pré-preenche o formulário de pedido. */
  precoPorProduto: Partial<Record<Produto, number>>;
}

export const CONFIG_PADRAO: Config = {
  diasRetornoAmostra: 7,
  maxParadasPorDia: 6,
  percentualFollowUp: 60,
  diasSemContatoAlerta: 21,
  cidadeBase: "Três Corações",
  precoPorProduto: {},
};

// ---------------------------------------------------------------------------
// Registros internos
// ---------------------------------------------------------------------------

/** Linha da tabela chave-valor usada para config e controle de seed. */
export interface Meta {
  chave: string;
  valor: unknown;
}
