import {SeplosModbusConnector} from "./seplosModbusConnector";

const connector = new SeplosModbusConnector('COM17')

const start = async () => {
    connector.debug = false
    connector.storeSize = 5

    await connector.init()
    connector.startCircularReading() // starting circular reading
    //await connector.readAllData() // one shot reading

    setInterval(async () => {
        console.log(connector.requestInfoStore()[0][1])
        const t1 = connector.requestInfoStore()[0][1].at(-1)!.timestamp
        const t2 = connector.requestInfoStore()[0][1].at(-2)!.timestamp
        console.log(t1-t2) //reading speed
    }, 1000)


}

start()