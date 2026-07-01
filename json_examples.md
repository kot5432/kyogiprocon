# ヘキサうどん ビジュアライザー JSON形式

## Mapデータ形式 (sample_map.json)

マップ設定ファイルの形式：

```json
{
  "startsAt": 1778227200,
  "daySeconds": [5, 5, 5, 10],
  "daySteps": [50, 100, 150, 200],
  "map": {
    "height": 8,
    "width": 8,
    "cells": [
      [3, 0, 1, 2, 0, 1, 2, 0],
      [3, 0, 1, 2, 0, 1, 2, 0],
      [3, 0, 1, 2, 0, 1, 2, 0],
      [3, 0, 1, 2, 0, 1, 2, 0],
      [3, 0, 1, 2, 0, 1, 2, 0],
      [3, 0, 1, 2, 0, 1, 2, 0],
      [3, 0, 1, 2, 0, 1, 2, 0],
      [3, 0, 1, 2, 0, 1, 2, 0]
    ]
  },
  "spots": [
    {"brand": 0, "pos": 1, "stocks": 4},
    {"brand": 1, "pos": 9, "stocks": 1},
    {"brand": 0, "pos": 17, "stocks": 1},
    {"brand": 1, "pos": 25, "stocks": 3}
  ],
  "agents": [4, 12, 20, 28],
  "fuelLimits": 20,
  "players": 8,
  "busyThreshold": 2,
  "jammedThreshold": 4
}
```

### フィールド説明
- `startsAt`: ゲーム開始タイムスタンプ
- `daySeconds`: 各日の秒数配列
- `daySteps`: 各日のステップ数配列
- `map`: マップ情報
  - `height`: マップの高さ
  - `width`: マップの幅
  - `cells`: セルタイプ配列 (0: 平原, 1: 道, 2: 山, 3: 池)
- `spots`: スポット情報配列
  - `brand`: ブランドID (0 or 1)
  - `pos`: 1次元位置インデックス
  - `stocks`: 在庫数
- `agents`: エージェント初期位置配列
- `fuelLimits`: 燃料上限
- `players`: プレイヤー数
- `busyThreshold`: 混雑しきい値
- `jammedThreshold`: 渋滞しきい値

## Dayデータ形式 (sample_day.json)

1日の状態データ形式：

```json
{
  "endsAt": 1778227205,
  "day": 1,
  "agents": [
    {
      "kind": 0,
      "pos": 1,
      "fuel": 20
    },
    {
      "kind": 1,
      "pos": 1,
      "fuel": 20
    },
    {
      "kind": 0,
      "pos": 9,
      "fuel": 10
    },
    {
      "kind": 0,
      "pos": 9,
      "fuel": 0
    }
  ],
  "others": [
    {
      "id": 0,
      "agents": [
        {
          "kind": 0,
          "pos": 1,
          "fuel": 2
        }
      ]
    }
  ],
  "traffics": [
    {
      "pos": 1,
      "status": 0
    }
  ]
}
```

### フィールド説明
- `endsAt`: 日の終了タイムスタンプ
- `day`: 日番号
- `agents`: 自チームのエージェント情報配列
  - `kind`: エージェントタイプ (0: 巡回車, 1: 補給車)
  - `pos`: 現在位置
  - `fuel`: 現在の燃料
- `others`: 他チーム情報配列
  - `id`: チームID
  - `agents`: そのチームのエージェント配列
- `traffics`: 交通情報配列
  - `pos`: 位置
  - `status`: 状態 (0: 通常, 1: 混雑, 2: 渋滞)

## ActionPlan形式

アクションプラン形式（エージェントごとの行動配列）：

```json
[
  [-15],
  [0, 1, -10]
]
```

### フィールド説明
- 外側の配列: エージェントごとの配列
- 内側の配列: 各ステップの行動
  - `-1`: 待機
  - `0-5`: 移動方向 (0: 北西, 1: 北東, 2: 東, 3: 南東, 4: 南西, 5: 西)

## 拡張形式（AI分析用）

AI判断理由やスコア履歴を含む拡張形式：

```json
{
  "agentTypes": [0, 1, 0, 0],
  "scoreHistory": [
    {"turn": 0, "ourScore": 0, "opponentScore": 0},
    {"turn": 10, "ourScore": 120, "opponentScore": 80}
  ],
  "days": [
    {
      "info": {
        "endsAt": 1778227205,
        "day": 1,
        "agents": [],
        "others": [],
        "traffics": []
      },
      "actions": [[-1], [0, 1, -10]],
      "extendedInfo": {
        "decisions": [
          {
            "target": "Spot 14",
            "reasons": [
              "残燃料で到達可能",
              "期待得点最大",
              "補給車が2ターン後に合流"
            ],
            "expectedScore": 150,
            "fuelCost": 5
          }
        ],
        "heatmap": [
          {"pos": 0, "value": 0.8},
          {"pos": 1, "value": 0.5}
        ]
      }
    }
  ]
}
```

### 拡張フィールド説明
- `agentTypes`: エージェントタイプ配列
- `scoreHistory`: スコア履歴配列
  - `turn`: ターン番号
  - `ourScore`: 自チームスコア
  - `opponentScore`: 相手チームスコア
- `days[].extendedInfo`: 拡張情報
  - `decisions`: AI判断理由配列
    - `target`: 目的地
    - `reasons`: 理由リスト
    - `expectedScore`: 期待得点
    - `fuelCost`: 燃料消費
  - `heatmap`: ヒートマップデータ
    - `pos`: 位置
    - `value`: 評価値 (0-1)
