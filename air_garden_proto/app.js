const API_URL = "https://airoco.necolico.jp/data-api/latest?id=CgETViZ2&subscription-key=6b8aa7133ece423c836c38af01c59880";
const SENSOR_NAME = "Ｒ３ー４０１";
const UPDATE_INTERVAL_MS = 60 * 1000;

const HIGH_HUMIDITY_THRESHOLD = 70;
const MOLD_STORAGE_KEY = "air-garden-high-humidity-start";

const elements = {
  scene: document.getElementById("scene"),
  rank: document.getElementById("rank"),
  co2: document.getElementById("co2"),
  temp: document.getElementById("temp"),
  humidity: document.getElementById("humidity"),
  co2Bar: document.getElementById("co2Bar"),
  tempBar: document.getElementById("tempBar"),
  humidityBar: document.getElementById("humidityBar"),
  message: document.getElementById("message"),
  laundryScore: document.getElementById("laundryScore"),
  laundryBar: document.getElementById("laundryBar"),
  laundryMessage: document.getElementById("laundryMessage"),
  laundryAdvice: document.getElementById("laundryAdvice"),
  moldRisk: document.getElementById("moldRisk"),
  moldBar: document.getElementById("moldBar"),
  moldMessage: document.getElementById("moldMessage"),
  moldDuration: document.getElementById("moldDuration"),
  moldAdvice: document.getElementById("moldAdvice"),
  quest: document.getElementById("quest"),
  questTitle: document.getElementById("questTitle"),
  questText: document.getElementById("questText"),
  mouth: document.getElementById("mouth"),
};

let highHumidityStartedAt = readHighHumidityStartedAt();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readHighHumidityStartedAt() {
  try {
    const savedValue = window.localStorage.getItem(MOLD_STORAGE_KEY);
    const savedTimestamp = Number(savedValue);
    return Number.isFinite(savedTimestamp) && savedTimestamp > 0 ? savedTimestamp : null;
  } catch (error) {
    return null;
  }
}

function saveHighHumidityStartedAt(timestamp) {
  try {
    if (timestamp) {
      window.localStorage.setItem(MOLD_STORAGE_KEY, String(timestamp));
    } else {
      window.localStorage.removeItem(MOLD_STORAGE_KEY);
    }
  } catch (error) {
    // localStorageが使えない環境でも，画面表示だけは継続する
  }
}

function getHighHumidityMinutes(humidity) {
  if (humidity >= HIGH_HUMIDITY_THRESHOLD) {
    if (!highHumidityStartedAt) {
      highHumidityStartedAt = Date.now();
      saveHighHumidityStartedAt(highHumidityStartedAt);
    }

    return Math.max(0, Math.floor((Date.now() - highHumidityStartedAt) / 60000));
  }

  highHumidityStartedAt = null;
  saveHighHumidityStartedAt(null);
  return 0;
}

function judgeStatus(data) {
  let score = 100;
  const quests = [];

  if (data.co2 >= 1500) {
    score -= 55;
    quests.push({
      title: "緊急換気クエスト！",
      text: "CO2濃度がかなり高くなっています．窓やドアを開けて換気しましょう．"
    });
  } else if (data.co2 >= 1000) {
    score -= 35;
    quests.push({
      title: "換気クエスト発生！",
      text: "CO2濃度が高くなっています．5〜10分ほど換気して様子を見ましょう．"
    });
  } else if (data.co2 >= 800) {
    score -= 15;
  }

  if (data.temp >= 30) {
    score -= 25;
    quests.push({
      title: "暑さ対策クエスト！",
      text: "室温が高くなっています．空調や水分補給を確認しましょう．"
    });
  } else if (data.temp >= 27) {
    score -= 10;
  }

  if (data.humidity >= 70) {
    score -= 15;
    quests.push({
      title: "じめじめ注意クエスト！",
      text: "湿度が高めです．換気や除湿を確認しましょう．"
    });
  } else if (data.humidity < 35) {
    score -= 10;
  }

  score = clamp(score, 0, 100);

  let rank = "S";
  if (score < 40) rank = "D";
  else if (score < 60) rank = "C";
  else if (score < 80) rank = "B";
  else if (score < 92) rank = "A";

  return { score, rank, quests };
}

function judgeLaundry(data) {
  const humidityPenalty = Math.max(0, data.humidity - 40) * 1.55;
  const tempEffect = data.temp >= 24 ? (data.temp - 24) * 2 : (data.temp - 24) * 3;
  const score = Math.round(clamp(100 - humidityPenalty + tempEffect, 0, 100));

  if (score >= 75) {
    return {
      score,
      message: "今なら部屋干しOK",
      advice: "湿度と温度の条件がよく，洗濯物が乾きやすい状態です．",
      level: "good"
    };
  }

  if (score >= 55) {
    return {
      score,
      message: "乾きますが少し時間がかかりそうです",
      advice: "扇風機や換気で空気を動かすと，より乾きやすくなります．",
      level: "warning"
    };
  }

  return {
    score,
    message: "湿度が高いため乾きにくいです",
    advice: "除湿機・換気推奨．干す間隔を広げるのも効果的です．",
    level: "danger"
  };
}

function judgeMold(data, highHumidityMinutes) {
  if (data.humidity >= 80 && highHumidityMinutes >= 30) {
    return {
      risk: "高",
      value: 100,
      message: "カビ警報：除湿推奨",
      advice: "高湿度が続いています．換気・除湿をすぐ確認してください．",
      level: "danger"
    };
  }

  if (data.humidity >= HIGH_HUMIDITY_THRESHOLD && highHumidityMinutes >= 60) {
    return {
      risk: "高",
      value: 90,
      message: "高湿度が続いています．換気してください",
      advice: "湿度70％以上が1時間以上続いているため，除湿をおすすめします．",
      level: "danger"
    };
  }

  if (data.humidity >= HIGH_HUMIDITY_THRESHOLD) {
    return {
      risk: "中",
      value: 65,
      message: "湿度70％超え。注意",
      advice: "この状態が続くとカビが発生しやすくなります．",
      level: "warning"
    };
  }

  if (data.humidity >= 65) {
    return {
      risk: "中",
      value: 45,
      message: "湿度がやや高めです",
      advice: "早めに換気して，70％を超えないようにしましょう．",
      level: "warning"
    };
  }

  return {
    risk: "低",
    value: 20,
    message: "カビ危険度：低",
    advice: "今の湿度ならカビは発生しにくい状態です．",
    level: "good"
  };
}

function updateBar(element, value, max, warningValue, dangerValue) {
  const percent = clamp((value / max) * 100, 0, 100);
  element.style.width = `${percent}%`;

  if (value >= dangerValue) {
    element.style.background = "#ef5b5b";
  } else if (value >= warningValue) {
    element.style.background = "#ffd76a";
  } else {
    element.style.background = "#6fc36a";
  }
}

function updateLevelBar(element, percent, level) {
  element.style.width = `${clamp(percent, 0, 100)}%`;

  if (level === "danger") {
    element.style.background = "#ef5b5b";
  } else if (level === "warning") {
    element.style.background = "#ffd76a";
  } else {
    element.style.background = "#6fc36a";
  }
}

function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes}分`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}時間` : `${hours}時間${remainingMinutes}分`;
}

function render(data) {
  const status = judgeStatus(data);
  const highHumidityMinutes = getHighHumidityMinutes(data.humidity);
  const laundry = judgeLaundry(data);
  const mold = judgeMold(data, highHumidityMinutes);
  const quests = [...status.quests];

  if (mold.level === "danger") {
    quests.unshift({
      title: "カビ警報クエスト！",
      text: `${mold.message} ${mold.advice}`
    });
  }

  elements.co2.textContent = Math.round(data.co2);
  elements.temp.textContent = data.temp.toFixed(1);
  elements.humidity.textContent = data.humidity.toFixed(1);
  elements.rank.textContent = status.rank;
  elements.laundryScore.textContent = laundry.score;
  elements.laundryMessage.textContent = laundry.message;
  elements.laundryAdvice.textContent = laundry.advice;
  elements.moldRisk.textContent = mold.risk;
  elements.moldMessage.textContent = mold.message;
  elements.moldDuration.textContent = formatDuration(highHumidityMinutes);
  elements.moldAdvice.textContent = mold.advice;

  updateBar(elements.co2Bar, data.co2, 2000, 800, 1000);
  updateBar(elements.tempBar, data.temp, 40, 27, 30);
  updateBar(elements.humidityBar, data.humidity, 100, 65, 70);
  updateLevelBar(elements.laundryBar, laundry.score, laundry.level);
  updateLevelBar(elements.moldBar, mold.value, mold.level);

  elements.scene.classList.remove("sunny", "cloudy", "rainy", "hot", "bad-air", "normal");
  elements.scene.classList.add(data.weather || "sunny");

  if (data.temp >= 30) {
    elements.scene.classList.add("hot");
  }

  if (data.co2 >= 1000) {
    elements.scene.classList.add("bad-air");
    elements.mouth.classList.remove("happy");
    elements.mouth.classList.add("sad");
  } else {
    elements.scene.classList.add("normal");
    elements.mouth.classList.remove("sad");
    elements.mouth.classList.add("happy");
  }

  if (quests.length > 0) {
    const quest = quests[0];
    elements.questTitle.textContent = quest.title;
    elements.questText.textContent = quest.text;
    elements.quest.classList.remove("hidden");
  } else {
    elements.quest.classList.add("hidden");
  }

  if (status.rank === "S" || status.rank === "A") {
    elements.message.textContent = "空気はおだやかです．キャラクターも元気に過ごしています．";
  } else if (status.rank === "B") {
    elements.message.textContent = "少し注意が必要です．しばらく様子を見ましょう．";
  } else if (status.rank === "C") {
    elements.message.textContent = "空気が重くなってきました．換気を検討してください．";
  } else {
    elements.message.textContent = "環境が悪化しています．早めの対応が必要です．";
  }
}

async function fetchStatus() {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Airoco API not ready");
    }

    const sensors = await response.json();
    console.log(sensors);

    const target = sensors.find(sensor => sensor.sensorName === SENSOR_NAME);
    console.log(target);

    if (!target) {
      throw new Error("指定したセンサーが見つかりません");
    }

    let weather = "sunny";

    if (Number(target.relativeHumidity) >= 70) {
      weather = "rainy";
    } else if (Number(target.co2) >= 1000) {
      weather = "cloudy";
    }

  const data = {
  co2: Number(target.co2),
  temp: Number(target.temperature),
  humidity: Number(target.relativeHumidity),
  weather: weather
};

    render(data);
  } catch (error) {
    console.error(error);
    elements.message.textContent = "Airoco APIからデータを取得できませんでした．";
  }
}


fetchStatus();
setInterval(fetchStatus, UPDATE_INTERVAL_MS);
