# 俄罗斯方块 - ER 图

## 数据库：SQLite（tetris.db）

### 表结构

#### users

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 用户 ID |
| username | TEXT | NOT NULL UNIQUE | 用户名 |
| password_hash | TEXT | NOT NULL | SHA-256 密码哈希 |
| display_name | TEXT | DEFAULT NULL | 显示名称 |
| key_settings | TEXT | DEFAULT NULL | 按键设置 JSON |
| das_settings | TEXT | DEFAULT NULL | DAS/ARR 设置 JSON |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 注册时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 最后更新时间 |

#### scores

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录 ID |
| user_id | INTEGER | FOREIGN KEY → users.id | 用户 |
| mode | TEXT | NOT NULL | 游戏模式（normal/speed/rhythm/mutation） |
| score | INTEGER | NOT NULL | 得分 |
| lines | INTEGER | DEFAULT 0 | 消除行数 |
| time_seconds | REAL | DEFAULT 0 | 游戏时长 |
| details | TEXT | DEFAULT NULL | 扩展信息 JSON |
| played_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 游戏时间 |

### ER 关系图（文本描述）

```
┌──────────────────────┐         ┌──────────────────────┐
│        users         │         │        scores        │
├──────────────────────┤         ├──────────────────────┤
│ id           PK      │◄────────│ user_id      FK      │
│ username     UNIQUE  │   1:N   │ mode          TEXT   │
│ password_hash TEXT   │         │ score         INT    │
│ display_name TEXT    │         │ lines         INT    │
│ key_settings  JSON   │         │ time_seconds  REAL   │
│ das_settings  JSON   │         │ details       JSON   │
│ created_at    TS     │         │ played_at     TS     │
│ updated_at    TS     │         └──────────────────────┘
└──────────────────────┘
```

### 关键索引

- `users.username` — UNIQUE 索引（登录查询）
- `scores.user_id` — 外键索引（用户战绩查询）
- `scores.mode` — 普通索引（按模式筛选）

### 默认演示账号

| username | password（明文） | key_settings | das_settings |
|----------|------------------|--------------|--------------|
| demo | demo123 | 系统默认按键 | das=10, arr=2, preview_count=5 |
*（内容由AI生成，仅供参考）*
