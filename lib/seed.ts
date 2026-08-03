/**
 * Carga inicial — 43 clientes reais e o roteiro da Semana 1 (03 a 07/08/2026).
 *
 * Os IDs são slugs fixos, não UUIDs. Isso torna a carga idempotente de verdade
 * (rodar duas vezes não duplica nada) e deixa o roteiro da Semana 1 legível,
 * referenciando "hosp-sao-sebastiao" em vez de um UUID opaco.
 *
 * `garantirSeed` nunca sobrescreve um registro existente: ela insere apenas o
 * que falta. Se o Henrique editar o telefone de um cliente, a edição fica.
 */

import { db, temIndexedDB } from "./db";
import { agora } from "./datas";
import {
  CONFIG_PADRAO,
  funilDoTipo,
  type Cliente,
  type DiaSemana,
  type ParadaRoteiro,
  type Roteiro,
  type TipoCliente,
} from "./types";

export const VERSAO_SEED = 1;

interface LinhaSeed {
  id: string;
  nome: string;
  tipo: TipoCliente;
  cidade: string;
  endereco: string;
  bairro: string;
  telefone: string;
  lat: number;
  lng: number;
}

const TC = "Três Corações";
const VG = "Varginha";

export const CLIENTES_SEED: LinhaSeed[] = [
  // --- Três Corações -------------------------------------------------------
  { id: "hosp-sao-sebastiao", nome: "Hospital São Sebastião", tipo: "hospital", cidade: TC, endereco: "R. Pedro Bonesio, 236", bairro: "Centro", telefone: "3532393950", lat: -21.6959412, lng: -45.2561161 },
  { id: "hosp-unimed-tc", nome: "Hospital Unimed Três Corações", tipo: "hospital", cidade: TC, endereco: "R. Ten. Clóvis Neder, 333", bairro: "Alto Perô", telefone: "3532396060", lat: -21.6885962, lng: -45.2655997 },
  { id: "casa-saude-santa-fe", nome: "Casa de Saúde Santa Fé", tipo: "hospital", cidade: TC, endereco: "Av. N. Sra. do Monte Calvário, 577", bairro: "Col. Santa Fé", telefone: "3532391301", lat: -21.6643232, lng: -45.2180844 },
  { id: "cirurgica-nc-ortocenter", nome: "Cirúrgica NC Ortocenter", tipo: "loja_medico_hospitalar", cidade: TC, endereco: "R. Des. Alberto Luz, 214", bairro: "Centro", telefone: "3532324698", lat: -21.6962398, lng: -45.2560780 },
  { id: "opus-medical", nome: "Opus Medical", tipo: "loja_medico_hospitalar", cidade: TC, endereco: "R. Ver. Dr. Antônio Augusto, 254", bairro: "", telefone: "35920022656", lat: -21.6797054, lng: -45.2634853 },
  { id: "animal-shop", nome: "Animal Shop", tipo: "petshop", cidade: TC, endereco: "Av. Dr. Moacir Rezende, 200", bairro: "Centro", telefone: "3532323395", lat: -21.6965734, lng: -45.2534865 },
  { id: "agropet", nome: "AGROPET", tipo: "petshop", cidade: TC, endereco: "R. Cornélio Andrade Pereira, 5", bairro: "Centro", telefone: "3532313099", lat: -21.6965868, lng: -45.2541973 },
  { id: "universo-das-racoes", nome: "Universo das Rações", tipo: "petshop", cidade: TC, endereco: "Pç. Monsenhor Fonseca, 3", bairro: "Centro", telefone: "3532326344", lat: -21.6957740, lng: -45.2541160 },
  { id: "petshop-ns-aparecida", nome: "Pet Shop Nossa Senhora Aparecida", tipo: "petshop", cidade: TC, endereco: "Av. Rei Pelé, 481", bairro: "N. Sra. Aparecida", telefone: "35984473417", lat: -21.6857976, lng: -45.2624653 },
  { id: "animania-vet", nome: "Animania Clínica Veterinária", tipo: "clinica_veterinaria", cidade: TC, endereco: "Av. Rei Pelé, 190", bairro: "Alto Perô", telefone: "35984042216", lat: -21.6878597, lng: -45.2602266 },
  { id: "veterinaria-tres-coracoes", nome: "Veterinária Três Corações", tipo: "clinica_veterinaria", cidade: TC, endereco: "Av. Rei Pelé, 616", bairro: "Alto Perô", telefone: "3532311110", lat: -21.6847126, lng: -45.2632307 },
  { id: "viana-pet", nome: "Viana Pet", tipo: "clinica_veterinaria", cidade: TC, endereco: "R. Ver. José Sonja, 268", bairro: "Jd. Eldorado 2", telefone: "35988633258", lat: -21.6826026, lng: -45.2635468 },
  { id: "mundo-pet", nome: "Mundo Pet", tipo: "petshop", cidade: TC, endereco: "Av. Des. José A. Weiss de Andrade, 568", bairro: "", telefone: "3521464734", lat: -21.6788616, lng: -45.2634190 },
  { id: "petshop-nha-chica", nome: "Pet Shop Nhá Chica", tipo: "petshop", cidade: TC, endereco: "Av. Pref. Orlando Rezende Andrade, 720", bairro: "", telefone: "3532341506", lat: -21.6890252, lng: -45.2526556 },
  { id: "petshop-mania-de-bicho", nome: "Pet Shop Mania de Bicho", tipo: "petshop", cidade: TC, endereco: "Av. Pref. Orlando Rezende Andrade, 801", bairro: "", telefone: "3532312229", lat: -21.6892534, lng: -45.2515479 },
  { id: "coutos-pet", nome: "Couto's Pet", tipo: "petshop", cidade: TC, endereco: "R. do Cordeiro, 45", bairro: "Jd. Paraíso", telefone: "35997228365", lat: -21.7257664, lng: -45.2621991 },

  // --- Varginha ------------------------------------------------------------
  { id: "hosp-unimed-varginha", nome: "Hospital Unimed Varginha", tipo: "hospital", cidade: VG, endereco: "R. Tomás Silva, 150", bairro: "Jd. Petrópolis", telefone: "3521064400", lat: -21.5659951, lng: -45.4466304 },
  { id: "hosp-regional-sul-minas", nome: "Hospital Regional do Sul de Minas", tipo: "hospital", cidade: VG, endereco: "Av. Rui Barbosa, 158", bairro: "Centro", telefone: "3536902800", lat: -21.5558679, lng: -45.4404279 },
  { id: "hosp-bom-pastor-onco", nome: "Hospital Bom Pastor - Oncologia", tipo: "hospital", cidade: VG, endereco: "R. Pres. Tancredo Neves, 500", bairro: "Bom Pastor", telefone: "3536063326", lat: -21.5479755, lng: -45.4489985 },
  { id: "hosp-bom-pastor-pa", nome: "Hospital Bom Pastor - Pronto Atendimento", tipo: "hospital", cidade: VG, endereco: "R. Pres. Tancredo Neves, 500", bairro: "Bom Pastor", telefone: "3536063311", lat: -21.5474735, lng: -45.4487290 },
  { id: "nefrosul", nome: "Nefrosul (hemodiálise)", tipo: "hospital", cidade: VG, endereco: "R. Pres. Tancredo Neves, 500", bairro: "Bom Pastor", telefone: "3532127508", lat: -21.5480580, lng: -45.4489060 },
  { id: "hosp-varginha-hapvida", nome: "Hospital Varginha - HapVida NotreDame", tipo: "hospital", cidade: VG, endereco: "Av. Antônieta Ésper Kalas, 299", bairro: "Pq. Mariela", telefone: "3532196851", lat: -21.5608735, lng: -45.4605621 },
  { id: "ultra-hospitalar", nome: "Ultra Hospitalar", tipo: "loja_medico_hospitalar", cidade: VG, endereco: "R. Espírito Santo, 19", bairro: "Centro", telefone: "35998397761", lat: -21.5504339, lng: -45.4412556 },
  { id: "acacia-saude-1", nome: "Acácia Saúde - Loja 1", tipo: "loja_medico_hospitalar", cidade: VG, endereco: "Pç. Quintino Bocaiúva, 40", bairro: "Centro", telefone: "3532147406", lat: -21.5541316, lng: -45.4371230 },
  { id: "acacia-saude-2", nome: "Acácia Saúde - Loja 2", tipo: "loja_medico_hospitalar", cidade: VG, endereco: "Av. Maj. Venâncio, 251", bairro: "Centro", telefone: "35998396407", lat: -21.5613970, lng: -45.4380118 },
  { id: "supernova-med-hosp", nome: "Supernova Médico Hospitalar", tipo: "loja_medico_hospitalar", cidade: VG, endereco: "Av. Maj. Venâncio, 149", bairro: "Centro", telefone: "3532143127", lat: -21.5607601, lng: -45.4387165 },
  { id: "promedica-medservice", nome: "Promédica Medservice", tipo: "loja_medico_hospitalar", cidade: VG, endereco: "R. José Limborco, 34", bairro: "Vila Limborco", telefone: "3532216882", lat: -21.5542467, lng: -45.4418197 },
  { id: "nre-produtos-med", nome: "NRE Produtos Médicos Hospitalares", tipo: "loja_medico_hospitalar", cidade: VG, endereco: "R. Maria Nazaret, 281", bairro: "Vila Martins", telefone: "3532146713", lat: -21.5611777, lng: -45.4458313 },
  { id: "prosaude", nome: "PROSAUDE", tipo: "loja_medico_hospitalar", cidade: VG, endereco: "R. Irmã Mariana Gutierrez, 9", bairro: "Vila Morais", telefone: "3536771406", lat: -21.5598327, lng: -45.4291129 },
  { id: "medlight", nome: "Medlight Equipamentos", tipo: "loja_medico_hospitalar", cidade: VG, endereco: "Av. Minas Gerais, 540", bairro: "Rezende", telefone: "3532129926", lat: -21.5843512, lng: -45.4386698 },
  { id: "petshop-dog-forte", nome: "Pet Shop Dog Forte", tipo: "petshop", cidade: VG, endereco: "R. Joaquim Paraguai, 10", bairro: "Vila Isabel", telefone: "3532127544", lat: -21.5687755, lng: -45.4381722 },
  { id: "petland-varginha", nome: "Petland Varginha", tipo: "petshop", cidade: VG, endereco: "Av. Francisco Navarra, 163", bairro: "Centro", telefone: "3536062505", lat: -21.5643030, lng: -45.4368790 },
  { id: "cantinho-dos-pets", nome: "Cantinho dos Pets", tipo: "petshop", cidade: VG, endereco: "Av. Celina Ferreira Ottoni, 686", bairro: "Rezende", telefone: "3530151740", lat: -21.5831110, lng: -45.4363720 },
  { id: "petshop-rancho-animal", nome: "Pet Shop Rancho Animal", tipo: "petshop", cidade: VG, endereco: "Av. Princesa do Sul, 494", bairro: "Jd. Andere", telefone: "3532141749", lat: -21.5728795, lng: -45.4399979 },
  { id: "bicho-mimado", nome: "Bicho Mimado Boutique Pet", tipo: "petshop", cidade: VG, endereco: "Av. Princesa do Sul, 67", bairro: "Jd. Andere", telefone: "3532149383", lat: -21.5700757, lng: -45.4384972 },
  { id: "petshop-latidos-miados", nome: "Pet Shop Latidos e Miados", tipo: "petshop", cidade: VG, endereco: "Av. Rio Branco, 87", bairro: "Centro", telefone: "35991154848", lat: -21.5571150, lng: -45.4352060 },
  { id: "petshop-arca-de-noe", nome: "Pet Shop Arca de Noé", tipo: "petshop", cidade: VG, endereco: "R. Santa Margarida, 165", bairro: "Bom Pastor", telefone: "3532221692", lat: -21.5518446, lng: -45.4445633 },
  { id: "imperio-dos-animais", nome: "Império dos Animais", tipo: "petshop", cidade: VG, endereco: "Av. dos Tachos, 84", bairro: "Sagrado Coração", telefone: "35988757374", lat: -21.5453673, lng: -45.4185468 },
  { id: "happy-pet", nome: "Happy Pet", tipo: "petshop", cidade: VG, endereco: "Av. Manuel Vida, 1245", bairro: "Imac. Conceição", telefone: "35997238950", lat: -21.5904389, lng: -45.4484852 },
  { id: "ipets", nome: "iPets", tipo: "petshop", cidade: VG, endereco: "R. Prof. Fernando Máximo, 28", bairro: "Campos Elíseos", telefone: "3536066878", lat: -21.5495082, lng: -45.4404542 },
  { id: "animal-center-racoes", nome: "Animal Center - Casa de Rações", tipo: "casa_racao", cidade: VG, endereco: "Av. Manuel Vida, 501", bairro: "Industrial JK", telefone: "3532211970", lat: -21.5840743, lng: -45.4454873 },
  { id: "pet-sao-francisco", nome: "Pet São Francisco de Assis", tipo: "petshop", cidade: VG, endereco: "Al. dos Guaratãs, 1", bairro: "Jd. Colonial", telefone: "3532147101", lat: -21.5623010, lng: -45.4220811 },
  { id: "imperio-pet", nome: "Império Pet", tipo: "casa_racao", cidade: VG, endereco: "R. Humberto Conde, 10", bairro: "Jd. Sion", telefone: "35910187887", lat: -21.5688685, lng: -45.4243894 },
];

// ---------------------------------------------------------------------------
// Roteiro da Semana 1 — 03 a 07/08/2026
// ---------------------------------------------------------------------------

type ParadaSeed = [clienteId: string, horario: string, objetivo: string];

interface DiaSeed {
  diaSemana: DiaSemana;
  data: string;
  cidade: string;
  titulo: string;
  tardeLivre: boolean;
  observacao?: string;
  paradas: ParadaSeed[];
}

const SEMANA_1: DiaSeed[] = [
  {
    diaSemana: 1,
    data: "2026-08-03",
    cidade: TC,
    titulo: "Centro — lojas e pet",
    tardeLivre: false,
    observacao: "Manhã reservada para alinhamento interno. Rua a partir das 10h.",
    paradas: [
      ["cirurgica-nc-ortocenter", "10:00", "Cápsula-Bag: quantos ostomizados atendem por mês?"],
      ["universo-das-racoes", "11:00", "Xô Xixi com o dono — ângulo filhote e cão sênior"],
      ["agropet", "11:30", "Xô Xixi — deixar material de balcão"],
      ["animal-shop", "14:00", "Xô Xixi — 2 unidades no balcão para teste de giro"],
      ["opus-medical", "15:00", "Cápsula-Bag — dimensionar demanda de ostomizados"],
    ],
  },
  {
    diaSemana: 2,
    data: "2026-08-04",
    cidade: VG,
    titulo: "Corredor médico-hospitalar",
    tardeLivre: false,
    observacao: "Dia de maior chance de pedido. Foco em Cápsula-Bag.",
    paradas: [
      ["ultra-hospitalar", "09:00", "Cápsula-Bag — dimensionar pedido pelo nº de ostomizados/mês"],
      ["promedica-medservice", "09:45", "Apresentar Cápsula-Bag e SSI"],
      ["acacia-saude-1", "10:30", "Cápsula-Bag — deixar 2 un. para teste de giro"],
      ["supernova-med-hosp", "11:15", "Cápsula-Bag — sondar se compra só de distribuidor"],
      ["nre-produtos-med", "14:00", "Cápsula-Bag — mapear quem compra"],
      ["acacia-saude-2", "15:00", "Confirmar se o decisor é o mesmo da Loja 1"],
    ],
  },
  {
    diaSemana: 3,
    data: "2026-08-05",
    cidade: TC,
    titulo: "Hospitais",
    tardeLivre: false,
    observacao: "Objetivo do dia é mapear decisor e agendar demonstração. Não vender.",
    paradas: [
      ["hosp-unimed-tc", "09:00", "Demo do SSI em 90s — mapear enfermagem, CCIH e compras"],
      ["hosp-sao-sebastiao", "10:30", "Demo do SSI — descobrir quem limpa derramamento hoje"],
      ["casa-saude-santa-fe", "14:00", "Demo do SSI — mapear decisor"],
      ["petshop-ns-aparecida", "15:30", "Xô Xixi com o dono — material de balcão"],
      ["mundo-pet", "16:15", "Xô Xixi — teste de giro"],
    ],
  },
  {
    diaSemana: 4,
    data: "2026-08-06",
    cidade: VG,
    titulo: "Hospitais",
    tardeLivre: false,
    paradas: [
      ["hosp-bom-pastor-onco", "08:30", "Demo do SSI — foco em quimioterapia e PGRSS"],
      ["nefrosul", "10:00", "Demo do SSI — hemodiálise é o maior gerador de derramamento"],
      ["petshop-arca-de-noe", "11:00", "Xô Xixi — encaixe entre os dois hospitais"],
      ["hosp-regional-sul-minas", "14:00", "Demo do SSI — mapear CCIH e modalidade de compra"],
      ["hosp-unimed-varginha", "15:30", "Demo do SSI — mapear bloco cirúrgico para a Cápsula"],
    ],
  },
  {
    diaSemana: 5,
    data: "2026-08-07",
    cidade: TC,
    titulo: "Varredura pet + fechamento da semana",
    tardeLivre: true,
    observacao: "Tarde reservada para follow-up telefônico e consolidação.",
    paradas: [
      ["petshop-nha-chica", "08:30", "Xô Xixi com o dono — material de balcão"],
      ["petshop-mania-de-bicho", "09:15", "Xô Xixi — teste de giro"],
      ["animania-vet", "10:00", "Falar com o veterinário — prescrição vale mais que prateleira"],
      ["veterinaria-tres-coracoes", "10:45", "Veterinário — ângulo filhote e cão sênior"],
      ["viana-pet", "11:30", "Veterinário — buscar indicação recorrente"],
    ],
  },
];

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------

function montarCliente(l: LinhaSeed, criadoEm: string): Cliente {
  return {
    id: l.id,
    nome: l.nome,
    tipo: l.tipo,
    cidade: l.cidade,
    bairro: l.bairro,
    endereco: l.endereco,
    telefone: l.telefone,
    lat: l.lat,
    lng: l.lng,
    funil: funilDoTipo(l.tipo),
    estagio: "prospect",
    status: "ativo",
    produtosInteresse: [],
    tags: [],
    criadoEm,
    observacoes: "",
  };
}

function montarRoteiro(d: DiaSeed): Roteiro {
  const paradas: ParadaRoteiro[] = d.paradas.map(([clienteId, horarioSugerido, objetivo], i) => ({
    ordem: i + 1,
    clienteId,
    horarioSugerido,
    objetivo,
    concluida: false,
  }));
  return {
    id: `r-s1-d${d.diaSemana}`,
    semana: 1,
    diaSemana: d.diaSemana,
    data: d.data,
    cidade: d.cidade,
    titulo: d.titulo,
    paradas,
    tardeLivre: d.tardeLivre,
    observacao: d.observacao,
  };
}

/**
 * Insere o que falta e nada mais. Segura para rodar a cada abertura do app:
 * registros existentes jamais são sobrescritos.
 *
 * Retorna quantos registros foram inseridos.
 */
export async function garantirSeed(): Promise<{ clientes: number; roteiros: number }> {
  if (!temIndexedDB()) return { clientes: 0, roteiros: 0 };

  return db.transaction("rw", db.clientes, db.roteiros, db.meta, async () => {
    const criadoEm = agora();

    const idsExistentes = new Set(await db.clientes.toCollection().primaryKeys());
    const faltantes = CLIENTES_SEED.filter((l) => !idsExistentes.has(l.id));
    if (faltantes.length) {
      await db.clientes.bulkAdd(faltantes.map((l) => montarCliente(l, criadoEm)));
    }

    const roteirosExistentes = new Set(await db.roteiros.toCollection().primaryKeys());
    const roteirosFaltantes = SEMANA_1.map(montarRoteiro).filter(
      (r) => !roteirosExistentes.has(r.id),
    );
    if (roteirosFaltantes.length) await db.roteiros.bulkAdd(roteirosFaltantes);

    if (!(await db.meta.get("config"))) {
      await db.meta.put({ chave: "config", valor: CONFIG_PADRAO });
    }
    await db.meta.put({
      chave: "seed",
      valor: { versao: VERSAO_SEED, aplicadoEm: criadoEm },
    });

    return { clientes: faltantes.length, roteiros: roteirosFaltantes.length };
  });
}
