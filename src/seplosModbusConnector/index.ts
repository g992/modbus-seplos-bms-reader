import {SerialPort} from 'serialport'
import {calcCheckSum, formBatteryIdStr} from "./utils";
import {StoreItem, Telemetry} from "./types";
import { ReadlineParser } from '@serialport/parser-readline'
import {clearInterval} from "timers";

export class SeplosModbusConnector {

    private readonly port: SerialPort
    private isPortOpened: boolean = false
    public debug: boolean = false
    public storeSize: number = 100
    private telemetryStore = new Map<string, StoreItem>()
    private telemetryRequested: boolean = false
    private teledataRequested: boolean = false
    public timeout: number = 250
    private parser: ReadlineParser
    private scannedDevices: number[] = []
    private circularReading: boolean = false

    constructor(port: string) {
        this.port = new SerialPort({
            path: port,
            baudRate: 19200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            autoOpen: false
        }).setEncoding('ascii');
        this.parser = this.port.pipe(new ReadlineParser({
            delimiter: '\r',
            encoding: 'ascii',
        }));
    }

    public async init() {
        await this.port.open()
        if(this.debug) console.log('Com port opened')
        this.isPortOpened = true
        await this.parseConnected()
    }

    private async parseConnected() {
        if(this.debug) console.log('Scanning for devices...')
        for (let i = 0; i <= 15; i++) {
            const present = await this.readTelemetryData(i)
            if(present) {
                this.scannedDevices.push(i)
                if(this.debug) console.log('Founded device at 0x' + formBatteryIdStr(i))
            }
        }
    }

    public async readAllData() {
        for (const id of this.scannedDevices) {
            await this.readTelemetryData(id)
            this.telemetryRequested = false
        }
    }


    public async readTelemetryData(cell: number) {
        if (this.telemetryRequested) return false
        this.telemetryRequested = true
        const request = this.formTelemetryRequest(cell)
        const res = await this.sendAndReceive(request)
        if (typeof res === 'boolean') {
            if (this.debug) console.log('Timed out')
            this.telemetryRequested = false
            return false
        }

        if (this.debug) console.log('Detected end of line, received message:', res)
        this.extractDataFromMessage(res.replace('~', ''))
        return true
    }

    private resetRequests() {
        this.teledataRequested = false
        this.telemetryRequested = false
    }

    private async sendAndReceive(message: string): Promise<string | boolean>{
        return new Promise((resolve) => {
            this.port.write(message);

            const timeout = setTimeout(() => {
                this.parser.removeAllListeners();
                resolve(false)
            }, this.timeout)

            this.parser.on('data', data => {
                clearInterval(timeout)
                this.parser.removeAllListeners();
                resolve(data as string);
            });
        });
    }

    private formTelemetryRequest(cell: number) {
        const command = '42'
        const battery = formBatteryIdStr(cell)
        const preformedStr = `20${battery}46${command}E002${battery}`
        const checksum = calcCheckSum(preformedStr)
        const str = `~${preformedStr}${checksum}\r`
        if(this.debug) console.log('Request string:', str)
        return str
    }

    private extractDataFromMessage(msg: string) {
        const checkSum = msg.slice(-4)
        const msgWOChkSum = msg.slice(0, -4)
        const calculatedCheckSum = calcCheckSum(msgWOChkSum)
        if(this.debug) console.log(calculatedCheckSum)
        if(checkSum !== calculatedCheckSum) {
            this.resetRequests()
            if(this.debug) console.log('Checksum mismatch!')
            return false
        }
        // const CID2 = parseInt(msgWOChkSum.slice(6, 8), 16)
        const address = parseInt(msgWOChkSum.slice(2, 4), 16)
        const addressString = '0x' + formBatteryIdStr(address)

        const info = msgWOChkSum.slice(12)
        if(this.telemetryRequested) this.extractTelemetryData(info, addressString)
    }

    private extractTelemetryData(msg: string, address: string) {
        const infoParsed = this.parseTelemetryInfo(msg)
        this.updateInfoInTelemetryStore(address, infoParsed)
        this.telemetryRequested = false
    }

    private parseTelemetryInfo(infoStr: string) {
        const result: Telemetry = new Telemetry()
        result.timestamp = Date.now()
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
        return result
    }

    // private parseHexIntFromStr(str: string, from: number, length: number){
    //     const to = from + length
    //     return parseInt(str.slice(from, to), 16)
    // }

    private updateInfoInTelemetryStore(address: string, info: Telemetry) {
        const candidate = this.telemetryStore.get(address)
        if(candidate === undefined) return this.telemetryStore.set(address, [info])
        candidate.push(info)
        const sliced = candidate.slice(-1 * this.storeSize)
        this.telemetryStore.set(address, sliced)
    }

    public requestInfoStore() {
        return [...this.telemetryStore.entries()]
    }

    public async startCircularReading() {
        if(this.circularReading) return
        this.circularReading = true
        while (this.circularReading) {
            await this.readAllData()
        }
        return
    }

    public stopCircularReading() {
        this.circularReading = false
    }


}
