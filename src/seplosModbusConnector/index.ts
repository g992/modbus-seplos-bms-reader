import {SerialPort} from 'serialport'
import {calcCheckSum, formBatteryIdStr} from "./utils";
import {Telemetry} from "./types";

export class SeplosModbusConnector {

    private port: SerialPort
    private isPortOpened: boolean = false
    private isParsingStart: boolean = false
    private isParsingEnd: boolean = false
    private messageString: string = ''
    public telemetryCallbacks: ((msg: Telemetry) => void)[] = []

    constructor(port: string) {
        this.port = new SerialPort({
            path: port,
            baudRate: 19200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            autoOpen: false
        });
    }

    public async init() {
        await this.port.open()
        console.log('Com port opened')
        this.isPortOpened = true
        this.port.on('readable', () => {
            const readBuffer = this.port.read()
            this.parseIncomingMessage(readBuffer)
        });
    }

    public async readTelemetryData(cell: number) {
        const request = this.formTelemetryRequest(cell)
        console.log('Request buffer:', request)
        return new Promise((resolve, reject) => {
            this.port.write(request, (err) => {
                if(err) reject(err)

            })

        })
    }

    private parseIncomingMessage(msg: Buffer) {
        const firstSymbol = msg[0]
        const lastSymbol = msg.at(-1)
        if(firstSymbol === 126) this.isParsingStart = true
        if(lastSymbol === 13) this.isParsingEnd = true
        if(this.isParsingStart) {
            this.messageString = msg.toString()
            console.log('Detected start of line, received message:', this.messageString)
            this.isParsingStart = false
        }
        else if(this.isParsingEnd) {
            this.messageString += msg.toString()
            console.log('Detected end of line, received message:', this.messageString)
            this.extractDataFromMessage(this.messageString.replace('~', ''))
            this.isParsingEnd = false
        }
        else {
            this.messageString += msg.toString()
            console.log('Parsing received message:', this.messageString)
        }
    }

    private formTelemetryRequest(cell: number) {
        const command = '42'
        const battery = formBatteryIdStr(cell)
        const preformedStr = `20${battery}46${command}E002${battery}`
        const checksum = calcCheckSum(preformedStr)
        const str = `~${preformedStr}${checksum}\r`
        console.log('Request string:', str)
        return new Buffer(str)
    }

    private extractDataFromMessage(msg: string) {
        msg = msg.slice(0, -1)
        const checkSum = msg.slice(-4)
        const msgWOChkSum = msg.slice(0, -4)
        const calculatedCheckSum = calcCheckSum(msgWOChkSum)
        if(checkSum !== calculatedCheckSum) {
            console.log('Checksum mismatch!')
            return false
        }
        console.log(calculatedCheckSum)
        const version = msgWOChkSum.slice(0, 2)
        const address = parseInt(msgWOChkSum.slice(2, 4), 16)
        const CID1 = msgWOChkSum.slice(4, 6)
        const CID2 = msgWOChkSum.slice(6, 8)
        const length = msgWOChkSum.slice(8, 12)
        const info = msgWOChkSum.slice(12)
        const infoParsed = this.parseTelemetryInfo(info, address)
        this.onTelemetryMessage(infoParsed)


    }

    private parseTelemetryInfo(infoStr: string, battery: number) {
        const result: Telemetry = new Telemetry()
        result.battery = battery
        let cursor = 4
        result.cellsCount = parseInt(infoStr.slice(cursor, cursor+2), 16)
        cursor += 2
        for (let i = 0; i < result.cellsCount; i++) {
            result.cellVoltage[i] = parseInt(infoStr.slice(cursor, cursor+4), 16)
            cursor += 4
        }
        result.tempCount = parseInt(infoStr.slice(cursor, cursor+2), 16)
        cursor += 2
        for (let i = 0; i < result.tempCount; i++) {
            result.temperatures[i] = (parseInt(infoStr.slice(cursor, cursor + 4), 16) - 2731) / 10
            cursor += 4
        }

        result.current = parseInt(infoStr.slice(cursor, cursor+4), 16)/100
        cursor += 4
        result.voltage = parseInt(infoStr.slice(cursor, cursor+4), 16)/100
        cursor += 4
        result.resCap = parseInt(infoStr.slice(cursor, cursor+4), 16)/100
        cursor += 4
        result.customNumber = parseInt(infoStr.slice(cursor, cursor+2), 16)
        cursor += 2
        result.capacity = parseInt(infoStr.slice(cursor, cursor+4), 16)/100
        cursor += 4
        result.soc = parseInt(infoStr.slice(cursor, cursor+4), 16)/10
        cursor += 4
        result.ratedCapacity = parseInt(infoStr.slice(cursor, cursor+4), 16)/100
        cursor += 4
        result.cycles = parseInt(infoStr.slice(cursor, cursor+4), 16)
        cursor += 4
        result.soh = parseInt(infoStr.slice(cursor, cursor+4), 16)/10
        cursor += 4
        result.portVoltage = parseInt(infoStr.slice(cursor, cursor+4), 16)/100
        // console.log(result)
        return result
    }

    public addTelemetryCallback(callback: (msg: Telemetry) => void) {
        this.telemetryCallbacks.push(callback)
    }
    private onTelemetryMessage (message: Telemetry) {
        for (const callback of this.telemetryCallbacks) {
            callback(message)
        }
    }
}
