import { Level } from '../game/constNum.js'

/**
 * Convert the enriched records used while rendering into the minimal API payload.
 * LEGACY is excluded because B30 analysis only covers EZ/HD/IN/AT charts.
 * @param {object} gameRecord
 */
export function buildGameRecordPayload(gameRecord) {
    return Object.fromEntries(
        Object.entries(gameRecord).map(([songId, records]) => {
            const levelRecords = /** @type {({score: number, acc: number, fc: boolean | number} | null)[]} */ (records)
            return [
                songId,
                levelRecords.slice(0, Level.length).map(record => record
                    ? {
                        score: record.score,
                        acc: record.acc,
                        fc: Boolean(record.fc),
                    }
                    : null),
            ]
        }),
    )
}
