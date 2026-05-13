"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPredictions = getPredictions;
exports.getPredictionByArea = getPredictionByArea;
const database_1 = require("@risk-radar/database");
function mapPrediction(p) {
    return {
        area: p.area,
        district: p.district ?? '',
        predictedCrimeType: p.predictedCrimeType,
        probability: p.probability,
        riskLevel: p.riskLevel,
        timeFrame: p.timeFrame,
        factors: Array.isArray(p.factors) ? p.factors : [],
        recommendations: Array.isArray(p.recommendations) ? p.recommendations : [],
    };
}
async function getPredictions(area) {
    const params = [];
    let n = 1;
    let where = `"validUntil" >= NOW()`;
    if (area) {
        params.push(`%${area}%`);
        where += ` AND area ILIKE $${n++}`;
    }
    params.push(20);
    const limitSlot = n;
    const predictions = await (0, database_1.query)(`SELECT area, district, "predictedCrimeType", probability, "riskLevel", "timeFrame", factors, recommendations
     FROM "CrimePrediction"
     WHERE ${where}
     ORDER BY probability DESC
     LIMIT $${limitSlot}`, params);
    return predictions.map(mapPrediction);
}
async function getPredictionByArea(area) {
    const prediction = await (0, database_1.query)(`SELECT area, district, "predictedCrimeType", probability, "riskLevel", "timeFrame", factors, recommendations
     FROM "CrimePrediction"
     WHERE area ILIKE $1 AND "validUntil" >= NOW()
     ORDER BY probability DESC
     LIMIT 1`, [`%${area}%`]);
    if (!prediction.length)
        return null;
    return mapPrediction(prediction[0]);
}
//# sourceMappingURL=prediction.js.map