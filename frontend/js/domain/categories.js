export const palettes = [
  "#ad8872",
  "#86a18a",
  "#b7a57c",
  "#9594b3",
  "#cb8e88",
  "#7b9aa7",
];

export const categoryStyle = (name) => {
  const known = {
    Alimentação: ["cart", "#e68a21"],
    Moradia: ["home", "#168bc0"],
    Transporte: ["car", "#b59428"],
    Saúde: ["heart", "#ef7189"],
    Educação: ["book", "#8170ce"],
    Salário: ["salary", "#13986b"],
    Receita: ["salary", "#13986b"],
    Eletrônicos: ["laptop", "#8062d5"],
    Assinaturas: ["repeat", "#8c72ca"],
    Lazer: ["leisure", "#d88150"],
    Pensão: ["users", "#c9789a"],
    "Dívidas de cartão": ["card", "#707fc6"],
    Empréstimos: ["bank", "#538f99"],
  };
  if (Object.hasOwn(known, name)) return known[name];
  return [
    "receipt",
    palettes[
      Array.from(name || "Outros").reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        palettes.length
    ],
  ];
};

export const mainCategories = [
  "Moradia",
  "Alimentação",
  "Saúde",
  "Transporte",
  "Educação",
  "Eletrônicos",
  "Assinaturas",
  "Lazer",
  "Pensão",
  "Dívidas de cartão",
  "Empréstimos",
];

export const categoryHints = {
  Moradia: "Aluguel, condomínio e contas da casa.",
  Alimentação: "Mercado, refeições e delivery.",
  Assinaturas: "Streaming, aplicativos e serviços mensais.",
  Lazer: "Passeios, viagens e entretenimento.",
  Pensão: "Pagamentos de pensão.",
  "Dívidas de cartão": "Compras parceladas e acordos do cartão.",
  Empréstimos: "Parcelas e pagamentos de empréstimos.",
};
