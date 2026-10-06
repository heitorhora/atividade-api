const express = require("express");

const app = express();

app.use(express.json());

const PORT = 3000;

let ordens = [];

/* ==========================================================================
   FUNÇÕES AUXILIARES / REGRAS DE NEGÓCIO
   ========================================================================== */

function calcularCustoUnitarioAjustado(tipoProduto, custoUnitarioBase) {
    switch (tipoProduto) {
        case 1:
            return custoUnitarioBase;
        case 2:
            return custoUnitarioBase * 1.10;
        case 3:
            return custoUnitarioBase * 1.20;
        default:
            return null;
    }
}

function calcularEstoqueFinal(estoqueInicial, quantidadeProduzida) {
    return estoqueInicial + quantidadeProduzida;
}

function calcularAlertaEstoque(estoqueFinal) {
    if (estoqueFinal > 5000) {
        return "ALTO";
    } else if (estoqueFinal < 500) {
        return "CRITICO";
    } else {
        return "NORMAL";
    }
}

function calcularDadosOrdem(ordem) {
    const custoUnitarioAjustado = calcularCustoUnitarioAjustado(
        ordem.tipoProduto,
        ordem.custoUnitarioBase
    );

    const estoqueFinal = calcularEstoqueFinal(
        ordem.estoqueInicial,
        ordem.quantidadeProduzida
    );

    const alertaEstoque = calcularAlertaEstoque(estoqueFinal);

    const custoTotal = ordem.quantidadeProduzida * custoUnitarioAjustado;

    return {
        ...ordem,
        custoUnitarioAjustado,
        estoqueFinal,
        custoTotal,
        alertaEstoque
    };
}

/* ==========================================================================
   1. POST /ordens - Cadastrar nova ordem
   ========================================================================== */
app.post("/ordens", (req, res) => {
    const {
        codigoOrdem,
        codigoProduto,
        tipoProduto,
        quantidadeProduzida,
        custoUnitarioBase,
        estoqueInicial
    } = req.body;

    // Verificar se todos os campos foram enviados
    if (
        codigoOrdem === undefined ||
        codigoProduto === undefined ||
        tipoProduto === undefined ||
        quantidadeProduzida === undefined ||
        custoUnitarioBase === undefined ||
        estoqueInicial === undefined
    ) {
        return res.status(400).json({
            erro: "Todos os campos são obrigatórios."
        });
    }

    // Verificar se o código da ordem já existe
    const ordemExistente = ordens.find(
        ordem => String(ordem.codigoOrdem) === String(codigoOrdem)
    );

    if (ordemExistente) {
        return res.status(400).json({
            erro: "codigoOrdem já existe."
        });
    }

    // Validar tipoProduto usando loop
    let tipoValido = false;
    for (let i = 1; i <= 3; i++) {
        if (tipoProduto === i) {
            tipoValido = true;
            break;
        }
    }

    if (!tipoValido) {
        return res.status(400).json({
            erro: "tipoProduto deve ser 1, 2 ou 3."
        });
    }

    // Criar a ordem com os campos calculados
    const novaOrdem = calcularDadosOrdem({
        codigoOrdem,
        codigoProduto,
        tipoProduto,
        quantidadeProduzida,
        custoUnitarioBase,
        estoqueInicial
    });

    // Adicionar ao array
    ordens.push(novaOrdem);

    return res.status(201).json(novaOrdem);
});

/* ==========================================================================
   2. GET /ordens - Listar todas (com suporte a filtros por tipo e alerta)
   ========================================================================== */
app.get("/ordens", (req, res) => {
    let resultado = [...ordens];
    const { tipo, alerta } = req.query;

    // Filtro opcional por tipoProduto (ex: /ordens?tipo=2)
    if (tipo) {
        resultado = resultado.filter(
            ordem => ordem.tipoProduto === Number(tipo)
        );
    }

    // Filtro opcional por alertaEstoque (ex: /ordens?alerta=ALTO)
    if (alerta) {
        resultado = resultado.filter(
            ordem => ordem.alertaEstoque.toUpperCase() === alerta.toUpperCase()
        );
    }

    return res.json(resultado);
});

/* ==========================================================================
   3. GET /ordens/:codigoOrdem - Buscar ordem específica por código
   ========================================================================== */
app.get("/ordens/:codigoOrdem", (req, res) => {
    const { codigoOrdem } = req.params;

    const ordem = ordens.find(
        o => String(o.codigoOrdem) === String(codigoOrdem)
    );

    if (!ordem) {
        return res.status(404).json({
            erro: "Ordem de produção não encontrada."
        });
    }

    return res.json(ordem);
});

/* ==========================================================================
   4. PUT /ordens/:codigoOrdem - Atualizar ordem existente e recalcular
   ========================================================================== */
app.put("/ordens/:codigoOrdem", (req, res) => {
    const { codigoOrdem } = req.params;

    const index = ordens.findIndex(
        o => String(o.codigoOrdem) === String(codigoOrdem)
    );

    if (index === -1) {
        return res.status(404).json({
            erro: "Ordem de produção não encontrada."
        });
    }

    const {
        codigoProduto,
        tipoProduto,
        quantidadeProduzida,
        custoUnitarioBase,
        estoqueInicial
    } = req.body;

    // Se o tipoProduto foi enviado para atualização, valida
    if (tipoProduto !== undefined) {
        let tipoValido = false;
        for (let i = 1; i <= 3; i++) {
            if (tipoProduto === i) {
                tipoValido = true;
                break;
            }
        }
        if (!tipoValido) {
            return res.status(400).json({
                erro: "tipoProduto deve ser 1, 2 ou 3."
            });
        }
    }

    const ordemAntiga = ordens[index];

    // Atualiza os dados mesclando novos valores fornecidos com os antigos
    const dadosAtualizados = {
        codigoOrdem: ordemAntiga.codigoOrdem,
        codigoProduto: codigoProduto !== undefined ? codigoProduto : ordemAntiga.codigoProduto,
        tipoProduto: tipoProduto !== undefined ? tipoProduto : ordemAntiga.tipoProduto,
        quantidadeProduzida: quantidadeProduzida !== undefined ? quantidadeProduzida : ordemAntiga.quantidadeProduzida,
        custoUnitarioBase: custoUnitarioBase !== undefined ? custoUnitarioBase : ordemAntiga.custoUnitarioBase,
        estoqueInicial: estoqueInicial !== undefined ? estoqueInicial : ordemAntiga.estoqueInicial
    };

    // Recalcula todos os campos derivados após alteração
    const ordemRecalculada = calcularDadosOrdem(dadosAtualizados);
    ordens[index] = ordemRecalculada;

    return res.json(ordemRecalculada);
});

/* ==========================================================================
   5. DELETE /ordens/:codigoOrdem - Remover uma ordem
   ========================================================================== */
app.delete("/ordens/:codigoOrdem", (req, res) => {
    const { codigoOrdem } = req.params;

    const index = ordens.findIndex(
        o => String(o.codigoOrdem) === String(codigoOrdem)
    );

    if (index === -1) {
        return res.status(404).json({
            erro: "Ordem de produção não encontrada."
        });
    }

    ordens.splice(index, 1);

    return res.json({
        mensagem: `Ordem de produção '${codigoOrdem}' removida com sucesso.`
    });
});

/* ==========================================================================
   6. GET /relatorios/ordens - Relatório consolidado
   ========================================================================== */
app.get("/relatorios/ordens", (req, res) => {
    const totalOrdens = ordens.length;

    if (totalOrdens === 0) {
        return res.json({
            totalOrdens: 0,
            estoquePorTipo: { padrao: 0, premium: 0, sobEncomenda: 0 },
            mediaCustoTotalPorOrdem: 0,
            ordemMaisCara: null,
            ordemMaisBarata: null,
            quantidadeAlertas: { alto: 0, critico: 0, normal: 0 },
            porProduto: {}
        });
    }

    let estoquePadrao = 0;
    let estoquePremium = 0;
    let estoqueSobEncomenda = 0;

    let somaCustoTotal = 0;

    let ordemMaisCara = ordens[0];
    let ordemMaisBarata = ordens[0];

    let alertasAlto = 0;
    let alertasCritico = 0;
    let alertasNormal = 0;

    const porProduto = {};

    for (const ordem of ordens) {
        // 1. Estoque final por tipo
        if (ordem.tipoProduto === 1) estoquePadrao += ordem.estoqueFinal;
        else if (ordem.tipoProduto === 2) estoquePremium += ordem.estoqueFinal;
        else if (ordem.tipoProduto === 3) estoqueSobEncomenda += ordem.estoqueFinal;

        // 2. Soma de custo total para calcular média
        somaCustoTotal += ordem.custoTotal;

        // 3. Identificar ordem mais cara e mais barata
        if (ordem.custoTotal > ordemMaisCara.custoTotal) {
            ordemMaisCara = ordem;
        }
        if (ordem.custoTotal < ordemMaisBarata.custoTotal) {
            ordemMaisBarata = ordem;
        }

        // 4. Quantidade de alertas
        if (ordem.alertaEstoque === "ALTO") alertasAlto++;
        else if (ordem.alertaEstoque === "CRITICO") alertasCritico++;
        else if (ordem.alertaEstoque === "NORMAL") alertasNormal++;

        // 5. Consolidação por produto
        const codProd = ordem.codigoProduto;
        if (!porProduto[codProd]) {
            porProduto[codProd] = {
                estoqueFinalConsolidado: 0,
                valorTotalInvestido: 0
            };
        }
        porProduto[codProd].estoqueFinalConsolidado += ordem.estoqueFinal;
        porProduto[codProd].valorTotalInvestido += ordem.custoTotal;
    }

    const mediaCustoTotalPorOrdem = somaCustoTotal / totalOrdens;

    return res.json({
        totalOrdens,
        estoquePorTipo: {
            padrao: estoquePadrao,
            premium: estoquePremium,
            sobEncomenda: estoqueSobEncomenda
        },
        mediaCustoTotalPorOrdem,
        ordemMaisCara: {
            codigoOrdem: ordemMaisCara.codigoOrdem,
            custoTotal: ordemMaisCara.custoTotal
        },
        ordemMaisBarata: {
            codigoOrdem: ordemMaisBarata.codigoOrdem,
            custoTotal: ordemMaisBarata.custoTotal
        },
        quantidadeAlertas: {
            alto: alertasAlto,
            critico: alertasCritico,
            normal: alertasNormal
        },
        porProduto
    });
});

/* ==========================================================================
   INICIALIZAÇÃO DO SERVIDOR
   ========================================================================== */
app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
});