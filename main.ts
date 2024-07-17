const enum DistanceUnit {
    //% block="cm"
    CM = 58, // Duration of echo round-trip in Microseconds (uS) for two centimeters, 343 m/s at sea level and 20°C
    //% block="inch"
    INCH = 148, // Duration of echo round-trip in Microseconds (uS) for two inches, 343 m/s at sea level and 20°C
}

//% color=#1ebed6 icon="\u272a" block="<LAB_CODE>"
//% category="LABCODE"
namespace LAB_CODE {
    const MICROBIT_LABCODE_ULTRASSONICO_OBJETO_DETECTADO_ID = 798;
    const caminho_maximo = 300 * DistanceUnit.CM;
    const MEDICOES_ULTRASSONICAS = 3;

    interface UltrasonicRoundTrip {
            ts: number;
    rtt: number;
}

let ultrasonicState: UltrasonicDevice;{

/**}
 * Configures the ultrassonic distance sensor and measures continuously in the background.
 * @param trig pin connected to trig, eg: DigitalPin.P12
 * @param echo pin connected to echo, eg: DigitalPin.P13
 */
//% subcategory="Ultrassônico"
//% blockId="labcode_ultrassonico_connectado"
//% block="conecte o sensor ultrassônico | em Trig em %trig | e Echo em %echo"
//% trig.fieldEditor="gridpicker"
//% trig.fieldOptions.columns=4
//% trig.fieldOptions.tooltips="false"
//% echo.fieldEditor="gridpicker"
//% echo.fieldOptions.columns=4
//% echo.fieldOptions.tooltips="false"
//% weight=80
export function connectUltrasonicDistanceSensor(
    trig: DigitalPin,
    echo: DigitalPin
): void {
    if (ultrasonicState && ultrasonicState.trig) {
        return;
    }

    if (!ultrasonicState) {
        ultrasonicState = {
            trig: trig,
            roundTrips: [{ ts: 0, rtt: caminho_maximo }],
            medianRoundTrip: caminho_maximo,
            travelTimeObservers: [],
        };
    } else {
        ultrasonicState.trig = trig;
    }

    pins.onPulsed(echo, PulseValue.High, () => {
        if (
            pins.pulseDuration() < caminho_maximo &&
            ultrasonicState.roundTrips.length <= MEDICOES_ULTRASSONICAS
        ) {
            ultrasonicState.roundTrips.push({
                ts: input.runningTime(),
                rtt: pins.pulseDuration(),
            });
        }
    });

    control.inBackground(measureInBackground);
}

/**
 * Do something when an object is detected the first time within a specified range.
 * @param distance distance to object, eg: 20
 * @param unit unit of distance, eg: DistanceUnit.CM
 * @param handler body code to run when the event is raised
 */
//% subcategory="Ultrassônico"
//% blockId=labcode_ultrasonic_on_object_detected
//% block="Objeto detectado a | %distance | %unit"
//% weight=69
export function onUltrasonicObjectDetected(
    distance: number,
    unit: DistanceUnit,
    handler: () => void
) {
    if (distance <= 0) {
        return;
    }

    if (!ultrasonicState) {
        ultrasonicState = {
            trig: undefined,
            roundTrips: [{ ts: 0, rtt: caminho_maximo }],
            medianRoundTrip: caminho_maximo,
            travelTimeObservers: [],
        };
    }

    const travelTimeThreshold = Math.imul(distance, unit);

    ultrasonicState.travelTimeObservers.push(travelTimeThreshold);

    control.onEvent(
        MICROBIT_LABCODE_ULTRASSONICO_OBJETO_DETECTADO_ID,
        travelTimeThreshold,
        () => {
            handler();
        }
    );
}

/**
 * Returns the distance to an object in a range from 1 to 300 centimeters or up to 118 inch.
 * The maximum value is returned to indicate when no object was detected.
 * -1 is returned when the device is not connected.
 * @param unit unit of distance, eg: DistanceUnit.CM
 */
//% subcategory="Ultrassônico"
//% blockId="labcode_ultrasSonico_distancia"
//% block="A distância é %unit"
//% weight=60

export function getUltrasonicDistance(unit: DistanceUnit): number {
    if (!ultrasonicState) {
        return -1;
    }
    basic.pause(0); // yield to allow background processing when called in a tight loop
    return Math.idiv(ultrasonicState.medianRoundTrip, unit);

/**
 * Returns `true` if an object is within the specified distance. `false` otherwise.
 *
 * @param distance distance to object, eg: 20
 * @param unit unit of distance, eg: DistanceUnit.CM
 */
//% subcategory="Ultrassônico"
//% blockId="labcode_ultrasonic_less_than"
//% block="A distância é menor que | %distance | %unit"
//% weight=50
export function isUltrasonicDistanceLessThan(
    distance: number,
    unit: DistanceUnit
): boolean {
    if (!ultrasonicState) {
        return false;
    }
    basic.pause(0); // yield to allow background processing when called in a tight loop
    return Math.idiv(ultrasonicState.medianRoundTrip, unit) < distance;
}

function triggerPulse() {
    // Reset trigger pin
    pins.setPull(ultrasonicState.trig, PinPullMode.PullNone);
    pins.digitalWritePin(ultrasonicState.trig, 0);
    control.waitMicros(2);

    // Trigger pulse
    pins.digitalWritePin(ultrasonicState.trig, 1);
    control.waitMicros(10);
    pins.digitalWritePin(ultrasonicState.trig, 0);
}

function getMedianRRT(roundTrips: UltrasonicRoundTrip[]) {
    const roundTripTimes = roundTrips.map((urt) => urt.rtt);
    return median(roundTripTimes);
}

// Returns median value of non-empty input
function median(values: number[]) {
    values.sort((a, b) => {
        return a - b;
    });
    return values[(values.length - 1) >> 1];
}

function measureInBackground() {
    const trips = ultrasonicState.roundTrips;
    const TIME_BETWEEN_PULSE_MS = 145;

    while (true) {
        const now = input.runningTime();

        if (trips[trips.length - 1].ts < now - TIME_BETWEEN_PULSE_MS - 10) {
            ultrasonicState.roundTrips.push({
                ts: now,
                rtt: caminho_maximo,
            });
        }

        while (trips.length > MEDICOES_ULTRASSONICAS) {
            trips.shift();
        }

        ultrasonicState.medianRoundTrip = getMedianRRT(
            ultrasonicState.roundTrips
        );

        for (let i = 0; i < ultrasonicState.travelTimeObservers.length; i++) {
            const threshold = ultrasonicState.travelTimeObservers[i];
            if (threshold > 0 && ultrasonicState.medianRoundTrip <= threshold) {
                control.raiseEvent(
                    MICROBIT_LABCODE_ULTRASSONICO_OBJETO_DETECTADO_ID,
                    threshold
                );
                // use negative sign to indicate that we notified the event
                ultrasonicState.travelTimeObservers[i] = -threshold;
            } else if (
                threshold < 0 &&
                ultrasonicState.medianRoundTrip > -threshold
            ) {
                // object is outside the detection threshold -> re-activate observer
                ultrasonicState.travelTimeObservers[i] = -threshold;
            }
        }}

        triggerPulse();
        basic.pause(TIME_BETWEEN_PULSE_MS);
    }
     //% subcategory=Sensores {
    enum TMP36Type {
        //% block="(℃)" enumval=0
        TMP36_temperature_C,

        //% block="(℉)" enumval=1
        TMP36_temperature_F,
    }
    namespace sensores{
    //% weight=10 color=#0fbc11 icon="\uf015"
   
        let Reference_VOLTAGE = 3100
        let crashSensorPin: DigitalPin
        export enum DHT11_state {
            //% block="temperatura(℃)" enumval=0
            DHT11_temperature_C,

            //% block="humidade(0~100)" enumval=1
            DHT11_humidity,
        }
        export enum RelayStateList {
            //% block="Fechado"
            On,

            //% block="Aberto"
            Off
        }
        export enum Distance_Unit_List {
            //% block="cm" 
            Distance_Unit_cm,

            //% block="inch"
            Distance_Unit_inch,
        }
        /**
        * TODO: Configuração do sensor de colisão
        */
        //% blockId=Sensor de Colisão  blockGap=10
        //% block="Configurando Sensor de Colisão no pino %crashpin"
        export function crashSensorSetup(crashpin: DigitalPin): void {
            crashSensorPin = crashpin;
            pins.setPull(crashpin, PinPullMode.PullUp)
        }

        /**
        * TODO: Verifica se o sensor de colisão está pressionado no momento.
        */
        //% blockId=Coloisão  blockGap=30
        //% block="Sensor de colisão pressionado"
        export function crashSensor(): boolean {
            let a: number = pins.digitalReadPin(crashSensorPin);
            if (a == 0) {
                return true;
            } else return false;
        }

        /**
        * TODO:obter umidade do solo(0~100%)
        * @param umidade do solo descreve o parâmetro aqui, por ex.: AnalogPin.P1
        */
        //% blockId="umidade do solo" block="valor da umidade do solo(0~100) no pin %soilhumiditypin"
        export function ReadSoilHumidity(soilmoisturepin: AnalogPin): number {
            let voltage = 0;
            let soilmoisture = 0;
            voltage = pins.map(
                pins.analogReadPin(soilmoisturepin),
                0,
                1023,
                0,
                100
            );
            soilmoisture = voltage;
            return Math.round(soilmoisture);
        }

        /**
        * TODO: obter intensidade de luz(0~100%)
        * @param pino de intensidade de luz descreva o parâmetro aqui, ex.: AnalogPin.P1
        */
        //% blockId="Sensor de Intensidade de Luz " block="Valor da intensidade de luz (0~100) no pino %lightintensitypin"
        export function ReadLightIntensity(lightintensitypin: AnalogPin): number {
            let voltage = 0;
            let lightintensity = 0;
            voltage = pins.map(
                pins.analogReadPin(lightintensitypin),
                0,
                1023,
                0,
                100
            );
            lightintensity = voltage;
            return Math.round(lightintensity);
        }

        /**
        * TODO: obter temperatura com sensor TMP36(℃ or ℉)
        * @param pino temporário descreve o parâmetro aqui, ex.: AnalogPin.P1
        */
        //% blockId="Leitura da temperatura" block="valor da temperatura %tmp36type|no pino %temppin"
        export function ReadTemperature(tmp36type: TMP36Type, temppin: AnalogPin): number {
            let voltage = 0;
            let Temperature = 0;
            pins.digitalWritePin(DigitalPin.P0, 0)
            voltage = pins.map(
                pins.analogReadPin(temppin),
                0,
                1023,
                0,
                Reference_VOLTAGE
            );
            Temperature = (voltage - 500) / 10;

            switch (tmp36type) {
                case 0:
                    return Math.round(Temperature)
                    break;
                case 1:
                    return Math.round(Temperature * 9 / 5 + 32)
                    break;
                default:
                    return 0
            }
        }

        /** 
        * TODO: Sensor de Som(dB)
        * @param Descreva o parametro do som aqui, eg: AnalogPin.P1
        */
        //% blockId="Sensor de Som" block="Medida do Som(dB) no pino %noisepin"
        export function ReadNoise(noisepin: AnalogPin): number {
            let level = 0
            let voltage = 0
            let noise = 0
            let h = 0
            let l = 0
            let sumh = 0
            let suml = 0
            pins.digitalWritePin(DigitalPin.P0, 0)
            for (let i = 0; i < 1000; i++) {
                level = level + pins.analogReadPin(noisepin)
            }
            level = level / 1000
            for (let i = 0; i < 1000; i++) {
                voltage = pins.analogReadPin(noisepin)
                if (voltage >= level) {
                    h += 1
                    sumh = sumh + voltage
                } else {
                    l += 1
                    suml = suml + voltage
                }
            }
            if (h == 0) {
                sumh = level
            } else {
                sumh = sumh / h
            }
            if (l == 0) {
                suml = level
            } else {
                suml = suml / l
            }
            noise = sumh - suml
            if (noise <= 4) {
                noise = pins.map(
                    noise,
                    0,
                    4,
                    30,
                    50
                )
            } else if (noise <= 8) {
                noise = pins.map(
                    noise,
                    4,
                    8,
                    50,
                    55
                )
            } else if (noise <= 14) {
                noise = pins.map(
                    noise,
                    9,
                    14,
                    55,
                    60
                )
            } else if (noise <= 32) {
                noise = pins.map(
                    noise,
                    15,
                    32,
                    60,
                    70
                )
            } else if (noise <= 60) {
                noise = pins.map(
                    noise,
                    33,
                    60,
                    70,
                    75
                )
            } else if (noise <= 100) {
                noise = pins.map(
                    noise,
                    61,
                    100,
                    75,
                    80
                )
            } else if (noise <= 150) {
                noise = pins.map(
                    noise,
                    101,
                    150,
                    80,
                    85
                )
            } else if (noise <= 231) {
                noise = pins.map(
                    noise,
                    151,
                    231,
                    85,
                    90
                )
            } else {
                noise = pins.map(
                    noise,
                    231,
                    1023,
                    90,
                    120
                )
            }
            noise = Math.round(noise)
            return Math.round(noise)
        
        /**
        * Sensor de Temperatura e Umidade DHT11
        * @param Descreve o parametro do sensor dht11 aqui, ex.: DigitalPin.P15     
        */
        //% blockId="Valor do sensor dht11" block="DHT11 valor do sensor %pin %dht11state"
        //% dht11state.fieldEditor="gridpicker" dht11state.fieldOptions.columns=1
        /*export function dht11Sensor(pin: DigitalPin, dht11state: DHT11_state): number {
            basic.pause(2000)  
            pins.digitalWritePin(pin, 0)
            basic.pause(18)
            let i = pins.digitalReadPin(pin)
            pins.setPull(pin, PinPullMode.PullUp);
            switch (dht11state) {
                case 0:
                    let dhtvalue1 = 0;
                    let dhtcounter1 = 0;
                    while (pins.digitalReadPin(pin) == 1);
                    while (pins.digitalReadPin(pin) == 0);
                    while (pins.digitalReadPin(pin) == 1);
                    for (let i = 0; i <= 32 - 1; i++) {
                        while (pins.digitalReadPin(pin) == 0);
                        dhtcounter1 = 0
                        while (pins.digitalReadPin(pin) == 1) {
                            dhtcounter1 += 1;
                        }
                        if (i > 15) {
                            if (dhtcounter1 > 2) {
                                dhtvalue1 = dhtvalue1 + (1 << (31 - i));
                            }
                        }
                    }
                    return ((dhtvalue1 & 0x0000ff00) >> 8);
                    break;
                case 1:
                    while (pins.digitalReadPin(pin) == 1);
                    while (pins.digitalReadPin(pin) == 0);
                    while (pins.digitalReadPin(pin) == 1);
    
                    let value = 0;
                    let counter = 0;
    
                    for (let i = 0; i <= 8 - 1; i++) {
                        while (pins.digitalReadPin(pin) == 0);
                        counter = 0
                        while (pins.digitalReadPin(pin) == 1) {
                            counter += 1;
                        }
                        if (counter > 3) {
                            value = value + (1 << (7 - i));
                        }
                    }
                    return value;
                default:
                    return 0;
            }
        }*/
        /**
        * alternar fãs
        */
        //% blockId=fans block="Motor fan %pin toggle to $fanstate || speed %speed \\%"
        //% fanstate.shadow="toggleOnOff"
        //% speed.min=0 speed.max=100
        //% expandableArgumentMode="toggle"
        export function motorFan(pin: AnalogPin, fanstate: boolean, speed: number = 100): void {
            if (fanstate) {
                pins.analogSetPeriod(pin, 100)
                pins.analogWritePin(pin, Math.map(speed, 0, 100, 0, 1023))
            }
            else {
                pins.analogWritePin(pin, 0)
                speed = 0
            }
        }
        /**
        * alternar Relê
        */
        //% blockId=Rele block="acionar relê no pino %pin para alternar seu estado %Relaystate"
        //% Relaystate.fieldEditor="gridpicker"
        //% Relaystate.fieldOptions.columns=1
        export function Relay(pin: DigitalPin, Relaystate: RelayStateList): void {
            switch (Relaystate) {
                case RelayStateList.On:
                    pins.digitalWritePin(pin, 0)
                    break;
                case RelayStateList.Off:
                    pins.digitalWritePin(pin, 1)
                    break;
            }
        }
        /**
    * Sensor de Distância Ultrassônico
    */
        //% blockId=sonarbit block="Sensor Ultrassônico trig pin%pinT echo %distance_unit"
        //% distance_unit.fieldEditor="gridpicker"
        //% distance_unit.fieldOptions.columns=2
        export function ultrasoundSensor(pinT: DigitalPin, distance_unit: Distance_Unit_List): number {
            pins.setPull(pinT, PinPullMode.PullNone)
            pins.digitalWritePin(pinT, 0)
            control.waitMicros(2)
            pins.digitalWritePin(pinT, 1)
            control.waitMicros(10)
            pins.digitalWritePin(pinT, 0)

            // read pulse
            let d = pins.pulseIn(pinT, PulseValue.High, 25000)
            let distance = d * 9 / 6 / 58

            if (distance > 400) {
                distance = 0
            }
            switch (distance_unit) {
                case Distance_Unit_List.Distance_Unit_cm:
                    return Math.floor(distance)  //cm
                    break
                case Distance_Unit_List.Distance_Unit_inch:
                    return Math.floor(distance / 254)   //inch
                    break
                default:
                    return 0
            }
        }
        /**
    * TODO: Detectar o valor da umidade do solo(0~100%)
    * @param Parametro do valor da umidade do solo, ex.: DigitalRJPin.J1
    */
        //% blockId="Sensor PIR" block="PIR sensor %pin detecta umidade"
        export function PIR(pin: DigitalPin): boolean {
            if (pins.digitalReadPin(pin) == 1) {
                return true
            }
            else {
                return false
            }
        }
        /**
        * Alternando leds
        */
        //% blockId=LED block="LED %pin alternando para $ledstate || brilho %brightness \\%"
        //% brightness.min=0 brightness.max=100
        //% ledstate.shadow="toggleOnOff"
        //% expandableArgumentMode="toggle"
        export function ledBrightness(pin: AnalogPin, ledstate: boolean, brightness: number = 100): void {
            if (ledstate) {
                pins.analogSetPeriod(pin, 100)
                pins.analogWritePin(pin, Math.map(brightness, 0, 100, 0, 1023))
            }
            else {
                pins.analogWritePin(pin, 0)
                brightness = 0
            }
        }

        //% blockId="Sensor raio UV" block="Sensor UV %pin nível(0~15)"
        export function UVLevel(pin: AnalogPin): number {
            let UVlevel = pins.analogReadPin(pin);
            if (UVlevel > 625) {
                UVlevel = 625
            }
            UVlevel = pins.map(
                UVlevel,
                0,
                625,
                0,
                15
            );
            return Math.round(UVlevel)
        }

        //% blockId="Sensor de álcool" block="Sensor de álcool %pin valor (0~100)"
        export function mq3(pin: AnalogPin): number {
            let mq3_value = pins.analogReadPin(pin);
            if (mq3_value > 1000) {
                mq3_value = 1000
            }
            let mq3_value_map = pins.map(mq3_value, 0, 1000, 0, 100)
            return Math.round(mq3_value_map);
        }

        function waitPinState(pin: DigitalPin, state: number, timeout_us: number): boolean {
            let timeout = input.runningTimeMicros() + timeout_us
            while (pins.digitalReadPin(pin) != state) {
                if (input.runningTimeMicros() > timeout) return false
            }
            return true
        }

        let _dht11_temp = -999.0
        let _dht11_humi = -999.0
        //% blockId="Leitura do sensor dht11" block="DHT11 sensor %Rjpin %dht11state valor"
        //% Rjpin.fieldEditor="gridpicker" dht11state.fieldEditor="gridpicker"
        //% Rjpin.fieldOptions.columns=2 dht11state.fieldOptions.columns=1
        export function dht11Sensor(pin: DigitalPin, dht11state: DHT11_state): number {
            //initialize
            let checksum: number = 0
            let checksumTmp: number = 0
            let dataArray: boolean[] = []
            let resultArray: number[] = []

            for (let index = 0; index < 40; index++) dataArray.push(false)
            for (let index = 0; index < 5; index++) resultArray.push(0)
            //request data
            pins.digitalWritePin(pin, 0) //begin protocol, pull down pin
            basic.pause(20)
            pins.setPull(pin, PinPullMode.PullUp) //pull up data pin if needed
            pins.digitalReadPin(pin) //pull up pin
            control.waitMicros(40)
            if (!waitPinState(pin, 1, 500)) return dht11state == DHT11_state.DHT11_humidity ? _dht11_humi : _dht11_temp
            if (!waitPinState(pin, 0, 500)) return dht11state == DHT11_state.DHT11_humidity ? _dht11_humi : _dht11_temp

            //read data (5 bytes)
            for (let index = 0; index < 40; index++) {
                if (!waitPinState(pin, 0, 500)) return dht11state == DHT11_state.DHT11_humidity ? _dht11_humi : _dht11_temp
                if (!waitPinState(pin, 1, 500)) return dht11state == DHT11_state.DHT11_humidity ? _dht11_humi : _dht11_temp
                control.waitMicros(28)
                //if sensor still pull up data pin after 28 us it means 1, otherwise 0
                if (pins.digitalReadPin(pin) == 1) dataArray[index] = true
            }

            //convert byte number array to integer
            for (let index = 0; index < 5; index++)
                for (let index2 = 0; index2 < 8; index2++)
                    if (dataArray[8 * index + index2]) resultArray[index] += 2 ** (7 - index2)

            //verify checksum
            checksumTmp = resultArray[0] + resultArray[1] + resultArray[2] + resultArray[3]
            checksum = resultArray[4]
            //read data if checksum ok
            if (checksum == (checksumTmp & 0xFF)) {
                _dht11_temp = resultArray[2] + resultArray[3] / 10
                _dht11_humi = resultArray[0] + resultArray[1] / 10
            }

            return dht11state == DHT11_state.DHT11_humidity ? _dht11_humi : _dht11_temp

        }

 
    namespace Seguidor_de_linha {
        let leftSensorPin: AnalogPin;
        let rightSensorPin: AnalogPin;

        let whiteLeft: number;
        let blackLeft: number;
        let whiteRight: number;
        let blackRight: number;

        let leftSensorValue: number = 0;
        let rightSensorValue: number = 0;
        const ALPHA = 0.5; // Współczynnik wygładzania (między 0 a 1)

        //% blockId=criando_sensores_linha block="Criando o sensor esquedo em %leftPin| e o sensor direito em %rightPin"
        //% weight=100 blockSetVariable=sensorlinha
        export function create(leftPin: AnalogPin, rightPin: AnalogPin): void {
            leftSensorPin = leftPin;
            rightSensorPin = rightPin;
        }

        //% blockId=CALIBRANDO_SENSOR_LINHA block="calibrando sensores"
        //% weight=90
        export function calibrate(): void {
            basic.showString("B");
            while (!input.buttonIsPressed(Button.A)) {
                basic.pause(100);
            }

            whiteLeft = getFilteredReading(leftSensorPin, true);
            whiteRight = getFilteredReading(rightSensorPin, true);

            basic.showString("P");
            while (!input.buttonIsPressed(Button.B)) {
                basic.pause(100);
            }

            blackLeft = getFilteredReading(leftSensorPin, true);
            blackRight = getFilteredReading(rightSensorPin, true);

            basic.showIcon(IconNames.Yes);
        }

        //% blockId=GRAVANDO_SENSOR_ESQUERDO block="Gravando sensor esquerdo"
        //% weight=80
        export function readLeftSensor(): number {
            return Math.round(getFilteredReading(leftSensorPin, false));
        }

        //% blockId=GRAVANDO_SENSOR_DIREITO block="Gravando sensor direito"
        //% weight=80
        export function readRightSensor(): number {
            return Math.round(getFilteredReading(rightSensorPin, false));
        }

        //% blockId=ativando_sensores block="sensor ativo %sensor"
        //% weight=70
        export function isOnLine(sensor: LineFollowerSensor): boolean {
            let sensorValue: number;
            let whiteValue: number;
            let blackValue: number;

            if (sensor === LineFollowerSensor.Left) {
                sensorValue = Math.round(getFilteredReading(leftSensorPin, false));
                whiteValue = whiteLeft;
                blackValue = blackLeft;
            } else {
                sensorValue = Math.round(getFilteredReading(rightSensorPin, false));
                whiteValue = whiteRight;
                blackValue = blackRight;
            }

            return (sensorValue > whiteValue && sensorValue < blackValue);
        }

        function getFilteredReading(pin: AnalogPin, isCalibration: boolean): number {
            let currentValue = pins.analogReadPin(pin);

            if (pin === leftSensorPin) {
                if (isCalibration) {
                    leftSensorValue = currentValue;
                } else {
                    leftSensorValue = ALPHA * currentValue + (1 - ALPHA) * leftSensorValue;
                }
                return leftSensorValue;
            } else {
                if (isCalibration) {
                    rightSensorValue = currentValue;
                } else {
                    rightSensorValue = ALPHA * currentValue + (1 - ALPHA) * rightSensorValue;
                }
                return rightSensorValue;
            }
        }

        // Enum for sensors
        export enum LineFollowerSensor {
            //% block="esquerdo"
            Left,
            //% block="direito"
            Right
        }
    }}}}}