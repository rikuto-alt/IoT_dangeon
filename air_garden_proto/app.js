const API_URL = "/api/status"; // Node-RED側でこのURLを返す想定
const UPDATE_INTERVAL_MS = 60 * 1000; // 試作用．本番では5分程度でもよい

const demoData = [
  { co2: 620, temp: 24.6, humidity: 52, weather: "sunny" },
  { co2: 890, temp: 25.4, humidity: 58, weather: "cloudy" },
  { co2: 1280, temp: 26.2, humidity: 66, weather: "cloudy" },
  { co2: 760, temp: 31.0, humidity: 64, weather: "sunny" },
  { co2: 680, temp: 24.2, humidity: 76, weather: "rainy" }
];

let demoIndex = 0;

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
  quest: document.getElementById("quest"),
  questTitle: document.getElementById("questTitle"),
  questText: document.getElementById("questText"),
  mouth: document.getElementById("mouth"),
  mockButton: document.getElementById("mockButton")
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function render(data) {
  const status = judgeStatus(data);

  elements.co2.textContent = Math.round(data.co2);
  elements.temp.textContent = data.temp.toFixed(1);
  elements.humidity.textContent = data.humidity.toFixed(1);
  elements.rank.textContent = status.rank;

  updateBar(elements.co2Bar, data.co2, 2000, 800, 1000);
  updateBar(elements.tempBar, data.temp, 40, 27, 30);
  updateBar(elements.humidityBar, data.humidity, 100, 65, 70);

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

  if (status.quests.length > 0) {
    const quest = status.quests[0];
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
      throw new Error("Node-RED API not ready");
    }

    const data = await response.json();
    render(data);
  } catch (error) {
    // Node-REDが未接続でも試作画面を確認できるようにデモ値を表示する
    render(demoData[demoIndex]);
  }
}

elements.mockButton.addEventListener("click", () => {
  demoIndex = (demoIndex + 1) % demoData.length;
  render(demoData[demoIndex]);
});

fetchStatus();
setInterval(fetchStatus, UPDATE_INTERVAL_MS);
