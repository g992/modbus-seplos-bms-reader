import {SeplosModbusConnector} from "./seplosModbusConnector";

const connector = new SeplosModbusConnector('COM17')

const start = async () => {
    await connector.init()
    connector.addTelemetryCallback((msg) => {
        console.log(msg)
    })
    await connector.readTelemetryData(0)
    await connector.readTelemetryData(0)
    await connector.readTelemetryData(0)


}

start()