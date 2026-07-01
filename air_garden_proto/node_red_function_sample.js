// Node-RED functionノード例
// http requestノードでAirocoのlatest APIをJSON取得した後に接続する想定

const sensorName = "Ｒ３ー４０１";
const sensors = msg.payload;

const target = sensors.find(sensor => sensor.sensorName === sensorName);

if (!target) {
    msg.payload = {
        co2: 0,
        temp: 0,
        humidity: 0,
        weather: "cloudy",
        error: "sensor not found"
    };
    return msg;
}

let weather = "sunny";

// まずはAirocoだけで仮の天気表現を決める
// 後で天気APIを使うなら，ここを外部APIの結果に置き換える
if (target.rh >= 70) {
    weather = "rainy";
} else if (target.co2 >= 1000) {
    weather = "cloudy";
}

msg.payload = {
    co2: Number(target.co2),
    temp: Number(target.temp),
    humidity: Number(target.rh),
    weather: weather
};

return msg;
