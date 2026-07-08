const API_URL = "https://airoco.necolico.jp/data-api/latest?id=CgETViZ2&subscription-key=6b8aa7133ece423c836c38af01c59880";
const UPDATE_INTERVAL_MS = 60 * 1000;

const HIGH_HUMIDITY_THRESHOLD = 70;
const MOLD_STORAGE_KEY = "air-garden-high-humidity-start";

const ROOMS = [
  {
    id: "r3-401",
    label: "R3-401",
    sensorNameCandidates: ["R3-401", "Ｒ３ー４０１", "Ｒ３－４０１"]
  },
  {
    id: "r3-403",
    label: "R3-403",
    sensorNameCandidates: ["R3-403", "Ｒ３ー４０３", "Ｒ３－４０３"]
  },
  {
    id: "r3-301",
    label: "R3-301",
    sensorNameCandidates: ["R3-301", "Ｒ３ー３０１", "Ｒ３－３０１"]
  }
];

const elements = {
  scene: document.getElementById("scene"),
  rank: document.getElementById("rank"),
  currentRoomLabel: document.getElementById("currentRoomLabel"),
  lastUpdated: document.getElementById("lastUpdated"),
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
  roomTabs: document.querySelectorAll(".room-tab")
};

let currentRoomIndex = 0;
let latestRoomResults = [];
const highHumidityStartedAtByRoom = {};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRoomName(name) {
  return String(name)
    .normalize("NFKC")
    .replace(/[ー－―−–—]/g, "-")
    .toUpperCase()
    .trim();
}

function readHighHumidityStartedAt(roomId) {
  try {
    const savedValue = window.localStorage.getItem(`${MOLD_STORAGE_KEY}-${roomId}`);
    const savedTimestamp = Number(savedValue);
    return Number.isFinite(savedTimestamp) && savedTimestamp > 0 ? savedTimestamp : null;
  } catch (error) {
    return null;
  }
}

function saveHighHumidityStartedAt(roomId, timestamp) {
  try {
    const key = `${MOLD_STORAGE_KEY}-${roomId}`;

    if (timestamp) {
      window.localStorage.setItem(key, String(timestamp));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    // localStorageが使えない環境でも，画面表示だけは継続する
  }
}

function getHighHumidityMinutes(roomId, humidity) {
  if (humidity >= HIGH_HUMIDITY_THRESHOLD) {
    let startedAt = highHumidityStartedAtByRoom[roomId];

    if (!startedAt) {
      startedAt = readHighHumidityStartedAt(roomId);
    }

    if (!startedAt) {
      startedAt = Date.now();
      saveHighHumidityStartedAt(roomId, startedAt);
    }

    highHumidityStartedAtByRoom[roomId] = startedAt;
    return Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  }

  highHumidityStartedAtByRoom[roomId] = null;
  saveHighHumidityStartedAt(roomId, null);
  return 0;
}

function getNumberValue(sensor, names) {
  for (const name of names) {
    if (sensor[name] !== undefined && sensor[name] !== null && sensor[name] !== "") {
      const value = Number(sensor[name]);

      if (Number.isFinite(value)) {
        return value;
      }
    }
  }

  return null;
}

function findSensorByRoom(sensors, room) {
  const normalizedCandidates = room.sensorNameCandidates.map(normalizeRoomName);

  return sensors.find(sensor => {
    const sensorName = sensor.sensorName ?? sensor.name ?? "";
    const normalizedSensorName = normalizeRoomName(sensorName);

    return normalizedCandidates.includes(normalizedSensorName);
  });
}

function normalizeSensorData(sensor) {
  const co2 = getNumberValue(sensor, ["co2", "CO2"]);
  const temp = getNumberValue(sensor, ["temperature", "temp"]);
  const humidity = getNumberValue(sensor, ["relativeHumidity", "rh", "humidity"]);

  if (co2 === null || temp === null || humidity === null) {
    return null;
  }

  let weather = "sunny";

  if (humidity >= 70) {
    weather = "rainy";
  } else if (co2 >= 1000) {
    weather = "cloudy";
  }

  return {
    co2,
    temp,
    humidity,
    weather
  };
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
      message: "湿度70％超え．注意",
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

function clearDisplayForError(room) {
  elements.currentRoomLabel.textContent = room.label;

  elements.co2.textContent = "---";
  elements.temp.textContent = "---";
  elements.humidity.textContent = "---";
  elements.rank.textContent = "--";

  updateLevelBar(elements.co2Bar, 0, "good");
  updateLevelBar(elements.tempBar, 0, "good");
  updateLevelBar(elements.humidityBar, 0, "good");
  updateLevelBar(elements.laundryBar, 0, "good");
  updateLevelBar(elements.moldBar, 0, "good");

  elements.laundryScore.textContent = "--";
  elements.laundryMessage.textContent = "この部屋のセンサーが見つかりません．";
  elements.laundryAdvice.textContent = "AirocoのsensorNameを確認してください．";

  elements.moldRisk.textContent = "--";
  elements.moldMessage.textContent = "判定できません．";
  elements.moldDuration.textContent = "0分";
  elements.moldAdvice.textContent = "データ取得後に表示されます．";

  elements.message.textContent = `${room.label} のデータを取得できませんでした．`;

  elements.scene.classList.remove("sunny", "cloudy", "rainy", "hot", "bad-air", "normal");
  elements.scene.classList.add("cloudy", "normal");

  elements.mouth.classList.remove("sad");
  elements.mouth.classList.add("happy");

  elements.questTitle.textContent = "センサー確認";
  elements.questText.textContent = `${room.label} に対応するAirocoセンサーが見つかりません．ConsoleのsensorNameを確認してください．`;
  elements.quest.classList.remove("hidden");
}

function renderRoom(roomResult) {
  if (!roomResult || roomResult.error) {
    const room = roomResult?.room ?? ROOMS[currentRoomIndex];
    clearDisplayForError(room);
    return;
  }

  const room = roomResult.room;
  const data = roomResult.data;

  elements.currentRoomLabel.textContent = room.label;

  const status = judgeStatus(data);
  const highHumidityMinutes = getHighHumidityMinutes(room.id, data.humidity);
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
    elements.questTitle.textContent = `${room.label}：${quest.title}`;
    elements.questText.textContent = quest.text;
    elements.quest.classList.remove("hidden");
  } else {
    elements.quest.classList.add("hidden");
  }

  if (status.rank === "S" || status.rank === "A") {
    elements.message.textContent = `${room.label} の空気はおだやかです．キャラクターも元気に過ごしています．`;
  } else if (status.rank === "B") {
    elements.message.textContent = `${room.label} は少し注意が必要です．しばらく様子を見ましょう．`;
  } else if (status.rank === "C") {
    elements.message.textContent = `${room.label} の空気が重くなってきました．換気を検討してください．`;
  } else {
    elements.message.textContent = `${room.label} の環境が悪化しています．早めの対応が必要です．`;
  }
}

function buildRoomResults(sensors) {
  return ROOMS.map(room => {
    const sensor = findSensorByRoom(sensors, room);

    if (!sensor) {
      return {
        room,
        data: null,
        error: true
      };
    }

    const data = normalizeSensorData(sensor);

    if (!data) {
      return {
        room,
        data: null,
        error: true
      };
    }

    return {
      room,
      data,
      error: false
    };
  });
}

function renderCurrentRoom() {
  const roomResult = latestRoomResults[currentRoomIndex];

  if (!roomResult) {
    clearDisplayForError(ROOMS[currentRoomIndex]);
    return;
  }

  renderRoom(roomResult);
}

function selectRoom(index) {
  currentRoomIndex = index;

  elements.roomTabs.forEach((tab, tabIndex) => {
    tab.classList.toggle("active", tabIndex === currentRoomIndex);
  });

  renderCurrentRoom();
}

async function fetchStatus() {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Airoco API not ready");
    }

    const sensors = await response.json();

    console.log("Airoco sensors:", sensors.map(sensor => sensor.sensorName ?? sensor.name));

    latestRoomResults = buildRoomResults(sensors);

    const now = new Date();
    elements.lastUpdated.textContent = `最終更新 ${now.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
    
    renderCurrentRoom();
  } catch (error) {
    console.error(error);

    elements.message.textContent = "Airoco APIからデータを取得できませんでした．";
    elements.questTitle.textContent = "通信エラー";
    elements.questText.textContent = "Airoco APIとの通信に失敗しました．しばらくしてから再読み込みしてください．";
    elements.quest.classList.remove("hidden");
  }
}

elements.roomTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    selectRoom(index);
  });
});

fetchStatus();
setInterval(fetchStatus, UPDATE_INTERVAL_MS);