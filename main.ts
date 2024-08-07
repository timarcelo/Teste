const enum DistanceUnit {
    //% block="cm"
    CM = 58, // Duration of echo round-trip in Microseconds (uS) for two centimeters, 343 m/s at sea level and 20°C
    //% block="inch"
    INCH = 148, // Duration of echo round-trip in Microseconds (uS) for two inches, 343 m/s at sea level and 20°C
}

//% color=#0fbc11 icon="\u272a" block="<LAB_CODE>"
//% category="LABCODE"
namespace LAB_CODE {
 const MICROBIT_LABCODE_ULTRASONIC_OBJECT_DETECTED_ID = 798;
  const MAX_ULTRASONIC_TRAVEL_TIME = 300 * DistanceUnit.CM;
   const ULTRASONIC_MEASUREMENTS = 3;

    interface UltrasonicRoundTrip {
            ts: number;
    rtt: number;
}

interface UltrasonicDevice {
    trig: DigitalPin | undefined;
    roundTrips: UltrasonicRoundTrip[];
    medianRoundTrip: number;
    travelTimeObservers: number[];
}

let ultrasonicState: UltrasonicDevice;

/**
 * Configures the ultrasonic distance sensor and measures continuously in the background.
 * @param trig pin connected to trig, eg: DigitalPin.P12
 * @param echo pin connected to echo, eg: DigitalPin.P13
 */
//% subcategory="Ultrasonico"
//% blockId="labcode_ultrasonico_connectado"
//% block="connecte o sensor de distancia ultrasonico | com Trig em %trig | e Echo em %echo"
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
            roundTrips: [{ ts: 0, rtt: MAX_ULTRASONIC_TRAVEL_TIME }],
            medianRoundTrip: MAX_ULTRASONIC_TRAVEL_TIME,
            travelTimeObservers: [],
        };
    } else {
        ultrasonicState.trig = trig;
    }

    pins.onPulsed(echo, PulseValue.High, () => {
        if (
            pins.pulseDuration() < MAX_ULTRASONIC_TRAVEL_TIME &&
            ultrasonicState.roundTrips.length <= ULTRASONIC_MEASUREMENTS
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
//% subcategory="Ultrasonico"
//% blockId=labcode_ultrasonic_on_object_detected
//% block="objeto detectado a | %distance | %unit"
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
            roundTrips: [{ ts: 0, rtt: MAX_ULTRASONIC_TRAVEL_TIME }],
            medianRoundTrip: MAX_ULTRASONIC_TRAVEL_TIME,
            travelTimeObservers: [],
        };
    }

    const travelTimeThreshold = Math.imul(distance, unit);

    ultrasonicState.travelTimeObservers.push(travelTimeThreshold);

    control.onEvent(
        MICROBIT_LABCODE_ULTRASONIC_OBJECT_DETECTED_ID,
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
//% subcategory="Ultrasonico"
//% blockId="labcode_ultrasonic_distance"
//% block="Distancia é %unit"
//% weight=60
export function getUltrasonicDistance(unit: DistanceUnit): number {
    if (!ultrasonicState) {
        return -1;
    }
    basic.pause(0); // yield to allow background processing when called in a tight loop
    return Math.idiv(ultrasonicState.medianRoundTrip, unit);
}

/**
 * Returns `true` if an object is within the specified distance. `false` otherwise.
 *
 * @param distance distance to object, eg: 20
 * @param unit unit of distance, eg: DistanceUnit.CM
 */
//% subcategory="Ultrasonico"
//% blockId="labcode_ultrasonic_less_than"
//% block="distância é menor que | %distance | %unit"
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
                rtt: MAX_ULTRASONIC_TRAVEL_TIME,
            });
        }

        while (trips.length > ULTRASONIC_MEASUREMENTS) {
            trips.shift();
        }

        ultrasonicState.medianRoundTrip = getMedianRRT(
            ultrasonicState.roundTrips
        );

        for (let i = 0; i < ultrasonicState.travelTimeObservers.length; i++) {
            const threshold = ultrasonicState.travelTimeObservers[i];
            if (threshold > 0 && ultrasonicState.medianRoundTrip <= threshold) {
                control.raiseEvent(
                    MICROBIT_LABCODE_ULTRASONIC_OBJECT_DETECTED_ID,
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
        }

        triggerPulse();
        basic.pause(TIME_BETWEEN_PULSE_MS);
    }}}