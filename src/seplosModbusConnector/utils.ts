export const calcCheckSum = (str: string): string => {
    const hexArr = str
        .split('')
        .map(c=>c.charCodeAt(0))
        .map(n=>n.toString(16))
    const parsedHexArr = hexArr.map(x => parseInt(x, 16))
    return ((parsedHexArr.reduce((a, b) => a + b, 0) ^ 0xFFFF) + 1).toString(16).toUpperCase()
}

export const formBatteryIdStr = (n: number): string => {
    if(n < 10) return '0' + n
    return n.toString()
}