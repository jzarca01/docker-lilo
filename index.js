const mqtt = require("mqtt");
const LILO = require('lilo');
const lights = require('lilo/lib/lights');

if(process.env.ENVIRONMENT === 'DEV') {
    require('dotenv').config();
    console.log(process.env);
}

const LIGHT_TOPIC = `${process.env.MQTT_TOPIC}/light/0/command`;
const TIME_TOPIC = `${process.env.MQTT_TOPIC}/time/0/command`;

const mqttClient = mqtt.connect(`mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`, {clientId:"mqtt-lilo", username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD});

mqttClient.on('connect', function() {
    console.log("Connected!");

    mqttClient.subscribe(LIGHT_TOPIC);
    mqttClient.subscribe(TIME_TOPIC);
    mqttClient.publish(process.env.MQTT_TOPIC, 'Subscribed');

    init();
});

mqttClient.on('message', async function(topic, message) {
    const decryptedMesage = message.toString();
    console.group(topic);
    console.log("message received", decryptedMesage);
    console.groupEnd();
    
    const instance = await getInstance();

    if(topic === LIGHT_TOPIC) {
       await new Promise((resolve, reject) => {
            // decryptedMessage = "03";
            resolve(instance.writeLightState(decryptedMesage));
       });
    }
    else if(topic === TIME_TOPIC) {
       await new Promise((resolve, reject) => {
            // decryptedMessage = 12,00,23,00;
            const timeRange = decryptedMesage.split(',');
            resolve(instance.writeTimeState(timeRange));
       });
    }
    return init(instance);
});

mqttClient.on('disconnect', function() {
    console.log("Disconnected");
});

mqttClient.on('reconnect', function() {
    console.log("Reconnected!");
    init();
});

mqttClient.on('error', function(err) {
    console.log("Error!", err);
    mqttClient.end();
    process.exit(1);
});

function formatTime(time) {
    return time.toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
    })
}

async function getInstance() {
    return await new Promise((resolve, reject) => 
        LILO.discover(liloInstance => {
            console.log("LILO Discovered.");

            liloInstance.on('disconnect', function () {
                console.log('LILO Disconnected.');
            });

            return liloInstance.connectAndSetup(function () {
                console.log('LILO Connected.')
                resolve(liloInstance);
            });
        })
    );
}

async function getData(instance) {
    if(!instance) {
        return undefined;
    }
    const light = await new Promise((resolve, reject) => {
        instance.readLightState(function(error, data) {
            const value = `0${data[0]}`;
            resolve({label: lights[value], value });
        });
    });

    const time = await new Promise((resolve, reject) => {
        instance.readTimeState(function(error, data) {
            const label = [`${formatTime(parseInt(data[0]))}:${formatTime(parseInt(data[1]))}`,`${formatTime(parseInt(data[2]))}:${formatTime(parseInt(data[3]))}`]
            resolve({label, value: [...data] });
        });
    });
    return {
        light,
        time,
    };
}

async function init(instance) {
    try {
        const currentInstance = instance ?? await getInstance();
        const data = await getData(currentInstance);
        console.log('data', data);
        if(data) {
            mqttClient.publish(
                `${process.env.MQTT_TOPIC}/lilo/state`,
                JSON.stringify(data),
                {
                    retain: true,
                }
            );
        }
        return currentInstance.disconnect();
    }
    catch(err) {
        console.log(err);
        mqttClient.publish(
            `${process.env.MQTT_TOPIC}/lilo/state`,
            JSON.stringify(err),
        );
        process.exit(1);
    }   
}