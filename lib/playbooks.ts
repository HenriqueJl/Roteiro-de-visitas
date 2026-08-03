/**
 * Roteiros de abordagem por tipo de cliente (seção 9).
 *
 * Dados, não JSX: ele vai querer reescrever isto depois das primeiras semanas
 * na rua, quando descobrir qual frase abre a porta e qual não. Editar uma
 * string aqui não deve exigir entender um componente.
 *
 * A estrutura é genérica de propósito — `secoes` com `itens` — para que o
 * componente renderize qualquer playbook sem saber o que tem dentro. Acrescentar
 * uma seção nova a um tipo não pede mudança de UI.
 */

import { PRODUTOS_POR_TIPO, type TipoCliente } from "./types";

export interface SecaoPlaybook {
  titulo: string;
  /** `true` numera os itens: é sequência a executar, não lista de lembretes. */
  ordenado?: boolean;
  itens: string[];
}

export interface Playbook {
  /** Uma linha: a tese da visita. É o que ele lê se só ler uma coisa. */
  resumo: string;
  secoes: SecaoPlaybook[];
}

const HOSPITAL: Playbook = {
  resumo:
    "A demonstração do SSI é a arma de entrada — é a única prova que cabe em 90 segundos.",
  secoes: [
    {
      titulo: "Sequência da demonstração",
      ordenado: true,
      itens: [
        "“Posso te mostrar uma coisa em dois minutos? Não vou te vender nada agora.”",
        "Derrama, aplica, recolhe.",
        "Só então pergunte: “quando acontece um derramamento aqui, quem limpa e quanto tempo leva?”",
        "Escute e anote sem interromper.",
        "Feche com pedido pequeno: dois frascos para a equipe testar, com data de retorno já marcada.",
      ],
    },
    {
      titulo: "Três papéis a mapear",
      itens: [
        "Quem sente a dor — enfermagem de CME, bloco, UTI, hemodiálise.",
        "Quem valida — CCIH, SESMT, responsável pelo PGRSS.",
        "Quem assina — compras.",
      ],
    },
    {
      titulo: "Antes de propor",
      itens: [
        "Se for hospital público, checar a modalidade de compra antes de qualquer proposta.",
      ],
    },
  ],
};

const LOJA: Playbook = {
  resumo: "Foco em Cápsula-Bag. O número de ostomizados atendidos dá o tamanho do pedido.",
  secoes: [
    {
      titulo: "Como conduzir",
      ordenado: true,
      itens: [
        "Pergunte quantos clientes ostomizados a loja atende por mês.",
        "Deixe 2 unidades no balcão para teste de giro.",
        "Marque o retorno na mesma conversa.",
      ],
    },
  ],
};

const PET: Playbook = {
  resumo:
    "Fale com o dono ou o veterinário, não com o atendente — prescrição vale mais que espaço em prateleira.",
  secoes: [
    {
      titulo: "Ângulo da conversa",
      itens: [
        "Filhote em fase de adaptação.",
        "Cão sênior com incontinência.",
      ],
    },
    {
      titulo: "Não esquecer",
      itens: ["Levar material de balcão.", "Ciclo é curto: dá para fechar na primeira visita."],
    },
  ],
};

const DISTRIBUIDOR: Playbook = {
  resumo:
    "Pista de alto valor: quem indica compra todo mês. Um contato desses vale mais que dez visitas de varejo.",
  secoes: [
    {
      titulo: "Quem procurar",
      itens: [
        "Enfermeiro estomaterapeuta.",
        "Polo de atenção à pessoa ostomizada.",
      ],
    },
    {
      titulo: "Como tratar",
      itens: [
        "Eles indicam o produto ao paciente, que compra todo mês.",
        "Marque com a etiqueta “indicador”.",
      ],
    },
    {
      titulo: "Atenção ao canal",
      itens: [
        "Já existe distribuidor atuando em Três Corações — confirme antes de propor preço.",
      ],
    },
  ],
};

export const PLAYBOOKS: Record<TipoCliente, Playbook> = {
  hospital: HOSPITAL,
  loja_medico_hospitalar: LOJA,
  petshop: PET,
  clinica_veterinaria: PET,
  casa_racao: PET,
  distribuidor: DISTRIBUIDOR,
};

/** Produtos a puxar da mochila para este tipo de cliente. */
export function produtosDoPlaybook(tipo: TipoCliente) {
  return PRODUTOS_POR_TIPO[tipo];
}
