# JSON形式のMapとActionPlanの例

## 例1: シンプルなmapとactionplan

```json
{
  "map": {
    "key1": "value1",
    "key2": "value2",
    "key3": 123
  },
  "actionplan": [
    {
      "step": 1,
      "action": "initialize",
      "description": "システムを初期化する"
    },
    {
      "step": 2,
      "action": "process",
      "description": "データを処理する"
    },
    {
      "step": 3,
      "action": "finalize",
      "description": "結果を保存する"
    }
  ]
}
```

## 例2: 複雑なmap構造

```json
{
  "map": {
    "users": {
      "user1": {
        "name": "Alice",
        "role": "admin",
        "permissions": ["read", "write", "delete"]
      },
      "user2": {
        "name": "Bob",
        "role": "user",
        "permissions": ["read"]
      }
    },
    "settings": {
      "timeout": 30,
      "retries": 3
    }
  },
  "actionplan": {
    "phase1": {
      "actions": ["setup", "configure"],
      "priority": "high"
    },
    "phase2": {
      "actions": ["deploy", "test"],
      "priority": "medium"
    }
  }
}
```

## 例3: プロジェクト管理用

```json
{
  "map": {
    "task_id_to_status": {
      "task001": "completed",
      "task002": "in_progress",
      "task003": "pending"
    },
    "resource_allocation": {
      "developer": 5,
      "designer": 2,
      "tester": 3
    }
  },
  "actionplan": [
    {
      "id": "action1",
      "type": "development",
      "tasks": ["task001", "task002"],
      "deadline": "2026-07-15",
      "assignees": ["dev1", "dev2"]
    },
    {
      "id": "action2",
      "type": "testing",
      "tasks": ["task003"],
      "deadline": "2026-07-20",
      "assignees": ["tester1"]
    }
  ]
}
```

## 例4: ゲーム/プロコン用（既存の形式を参考）

```json
{
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
  "actionplan": [
    {
      "agent_id": 0,
      "actions": [
        {"type": "move", "direction": "up"},
        {"type": "collect", "target": "spot1"},
        {"type": "deliver", "destination": "base"}
      ]
    },
    {
      "agent_id": 1,
      "actions": [
        {"type": "move", "direction": "right"},
        {"type": "wait", "duration": 2}
      ]
    }
  ]
}
```

## 説明

- **map**: キーと値のペアを保持するデータ構造。地形、設定、ユーザー情報などを表現
- **actionplan**: 実行すべきアクションや手順を定義する配列またはオブジェクト。ステップ、優先度、担当者などを含む
