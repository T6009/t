# 俄罗斯方块 - ER 图

## 数据库：SQLite（tetris.db）

### 表结构

#### accounts

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 用户 ID |
| username | TEXT | NOT NULL UNIQUE | 用户名 |
| password_hash | TEXT | NOT NULL | bcrypt 密码哈希 |
| key_settings | TEXT | DEFAULT '{}' | 按键设置 JSON |
| das_settings | TEXT | DEFAULT '{}' | DAS/ARR/预览数量 JSON |
| color_settings | TEXT | DEFAULT '{}' | 方块颜色 JSON |
| role | TEXT | DEFAULT 'user' | 角色（user / admin） |
| is_banned | INTEGER | DEFAULT 0 | 是否被封禁 |

#### records

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录 ID |
| username | TEXT | NOT NULL | 用户名 |
| mode | TEXT | NOT NULL | 游戏模式（normal/speed/rhythm/mutation） |
| score | INTEGER | NOT NULL | 得分 |
| lines_cleared | INTEGER | DEFAULT 0 | 消除行数 |
| time_seconds | REAL | DEFAULT 0 | 游戏时长 |
| detail | TEXT | DEFAULT NULL | 扩展信息 JSON |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 记录时间 |

#### login_logs

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 日志 ID |
| username | TEXT | NOT NULL | 用户名 |
| ip_address | TEXT | NOT NULL | 客户端 IP 地址 |
| login_time | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登录时间 |

#### ip_links

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 关联 ID |
| ip_address | TEXT | NOT NULL | IP 地址 |
| username1 | TEXT | NOT NULL | 账号1（字母序较小） |
| username2 | TEXT | NOT NULL | 账号2（字母序较大） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 确认时间 |

#### announcements

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 公告 ID |
| title | TEXT | NOT NULL | 公告标题 |
| content | TEXT | NOT NULL | 公告正文 |
| publisher | TEXT | NOT NULL | 发布者用户名 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 发布时间 |
| is_revoked | INTEGER | DEFAULT 0 | 是否已撤回（0=正常，1=已撤回） |

### ER 关系图（文本描述）

```
┌──────────────────────┐         ┌──────────────────────┐
│       accounts       │         │       records        │
├──────────────────────┤         ├──────────────────────┤
│ id           PK      │         │ id            PK     │
│ username     UNIQUE  │───1:N───│ username      TEXT   │
│ password_hash TEXT   │         │ mode          TEXT   │
│ key_settings  JSON   │         │ score         INT    │
│ das_settings  JSON   │         │ lines_cleared INT    │
│ color_settings JSON  │         │ time_seconds  REAL   │
│ role          TEXT   │         │ detail        TEXT   │
│ is_banned     INT    │         │ created_at    TS     │
└──────────────────────┘         └──────────────────────┘
            │
            │ 1:N
            ▼
┌──────────────────────┐
│      login_logs      │
├──────────────────────┤
│ id            PK     │
│ username      TEXT   │
│ ip_address    TEXT   │
│ login_time    TS     │
└──────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│       ip_links       │  记录同 IP 下   │     accounts         │
├──────────────────────┤  用户两两关联  ├──────────────────────┤
│ id            PK     │◄────────────►│  username  UNIQUE   │
│ ip_address    TEXT   │  (N:M 通过    └──────────────────────┘
│ username1     TEXT   │   ip_links)
│ username2     TEXT   │
│ created_at    TS     │
└──────────────────────┘

┌──────────────────────┐
│    announcements     │
├──────────────────────┤
│ id            PK     │
│ title         TEXT   │
│ content       TEXT   │
│ publisher     TEXT   │
│ created_at    TS     │
│ is_revoked    INT    │
└──────────────────────┘
```

### 关键索引

- `accounts.username` — UNIQUE 索引（登录查询）
- `records.username` — 索引（用户战绩查询）
- `records.mode` — 索引（按模式筛选）

### 默认演示账号

| username | password | role | 说明 |
|----------|----------|------|------|
| Player1 | 111111 | user | 演示账号 |
| DemoUser | 222222 | user | 演示账号 |
| TestPlayer | 333333 | user | 演示账号 |
| admin | admin123456 | admin | 管理员账号 |

*（内容由AI生成，仅供参考）*
