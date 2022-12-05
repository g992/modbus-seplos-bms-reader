export class Telemetry {
    timestamp: number = 0
    cellsCount: number = 0
    cellVoltage: number[] = []
    tempCount: number = 0
    temperatures: number[] = []
    current: number = 0
    voltage: number = 0
    resCap: number = 0
    customNumber: number = 0
    capacity: number = 0
    soc: number = 0
    ratedCapacity: number = 0
    cycles: number = 0
    soh: number = 0
    portVoltage: number = 0
}

export type StoreItem = Telemetry[]

export const telemetryMapping = [
    {
        name: 'cellsCount',
        length: 2
    },
    {
        name: 'cellVoltage',
        length: 4
    },
    {
        name: 'tempCount',
        length: 2
    },
    {
        name: 'temperatures',
        length: 4
    },
    {
        name: 'current',
        length: 4
    },
    {
        name: 'voltage',
        length: 4
    },
    {
        name: 'resCap',
        length: 4
    },
    {
        name: 'customNumber',
        length: 2
    },
    {
        name: 'capacity',
        length: 4
    },
    {
        name: 'soc',
        length: 4
    },
    {
        name: 'ratedCapacity',
        length: 4
    },
    {
        name: 'cycles',
        length: 4
    },
    {
        name: 'soh',
        length: 4
    },
    {
        name: 'portVoltage',
        length: 4
    },
]