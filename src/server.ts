/**
 * server.ts — 競技サーバー通信モジュール
 *
 * ヘキサうどん競技サーバーとのHTTP/1.1 GET・POST通信を担当する。
 * 詳細プロトコルは2026年7月上旬に公式サイトで公開予定。
 * エンドポイントパスは setConfig() で差し替え可能な設計とする。
 *
 * 参考ルール:
 *   - HTTP/1.1 のみ対応 (Q41)
 *   - 秒間5リクエストを目安 (Q42)
 *   - POST/GET 形式でデータ送受信
 */

import type { MapData, DayInfo, AgentTypes, ActionPlan } from './types';

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

/** サーバー接続設定 */
export interface ServerConfig {
    /** 競技サーバーのベースURL (例: http://192.168.1.100:8080) */
    baseUrl: string;
    /** 自チームID (試合ごとに割り当てられる) */
    teamId: number;
    /** リクエストタイムアウト [ms] */
    timeoutMs: number;
}

/** サーバーレスポンスの共通ラッパー */
export interface ServerResult<T> {
    ok: boolean;
    data?: T;
    error?: string;
    statusCode?: number;
    elapsedMs?: number;
}

/** ポーリング設定 */
export interface PollOptions {
    /** ポーリング間隔 [ms] (デフォルト: 500ms) */
    intervalMs?: number;
    /** タイムアウト [ms] (デフォルト: 30000ms) */
    timeoutMs?: number;
}

// -------------------------------------------------------
// レート制限 (Q42: 秒間5リクエストを目安)
// -------------------------------------------------------
const MIN_INTERVAL_MS = 200; // 1000ms / 5req = 200ms

class RateLimiter {
    private lastRequestAt = 0;

    async wait(): Promise<void> {
        const now = Date.now();
        const elapsed = now - this.lastRequestAt;
        if (elapsed < MIN_INTERVAL_MS) {
            await sleep(MIN_INTERVAL_MS - elapsed);
        }
        this.lastRequestAt = Date.now();
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------------------------------------------
// ServerClient クラス
// -------------------------------------------------------

export class ServerClient {
    private config: ServerConfig;
    private rateLimiter = new RateLimiter();
    private abortController: AbortController | null = null;

    /** 接続ログ (最新50件) */
    readonly logs: { ts: number; type: 'send' | 'recv' | 'error'; message: string }[] = [];

    constructor(config: ServerConfig) {
        this.config = config;
    }

    /** 設定を更新する */
    setConfig(config: Partial<ServerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    getConfig(): Readonly<ServerConfig> {
        return this.config;
    }

    // --------------------------------------------------
    // 試合開始前: マップ構成を取得
    // GET /map
    // --------------------------------------------------
    async fetchMapData(): Promise<ServerResult<MapData>> {
        return this.get<MapData>('/map');
    }

    // --------------------------------------------------
    // 試合開始時: エージェント種別を送信
    // POST /agents  body: AgentTypes (number[])
    // --------------------------------------------------
    async postAgentTypes(types: AgentTypes): Promise<ServerResult<void>> {
        return this.post<void>('/agents', types);
    }

    // --------------------------------------------------
    // 各日開始時: その日の試合情報を取得
    // GET /day
    // --------------------------------------------------
    async fetchDayInfo(): Promise<ServerResult<DayInfo>> {
        return this.get<DayInfo>('/day');
    }

    // --------------------------------------------------
    // 各日の回答時間内: 行動計画を送信
    // POST /action  body: ActionPlan (number[][])
    // --------------------------------------------------
    async postActionPlan(plan: ActionPlan): Promise<ServerResult<{ valid: boolean; message?: string }>> {
        return this.post('/action', plan);
    }

    // --------------------------------------------------
    // 接続テスト (GET /ping など)
    // --------------------------------------------------
    async ping(): Promise<ServerResult<unknown>> {
        return this.get('/ping');
    }

    // --------------------------------------------------
    // 汎用 GET
    // --------------------------------------------------
    async get<T>(path: string): Promise<ServerResult<T>> {
        await this.rateLimiter.wait();
        const url = this.config.baseUrl.replace(/\/$/, '') + path;
        const startAt = Date.now();

        this.addLog('send', `GET ${url}`);

        try {
            this.abortController = new AbortController();
            const timer = setTimeout(
                () => this.abortController?.abort(),
                this.config.timeoutMs
            );

            const res = await fetch(url, {
                method: 'GET',
                signal: this.abortController.signal,
            });
            clearTimeout(timer);

            const elapsed = Date.now() - startAt;

            if (!res.ok) {
                const msg = `HTTP ${res.status} ${res.statusText}`;
                this.addLog('error', msg);
                return { ok: false, error: msg, statusCode: res.status, elapsedMs: elapsed };
            }

            const data: T = await res.json();
            this.addLog('recv', `${res.status} OK (${elapsed}ms)`);
            return { ok: true, data, statusCode: res.status, elapsedMs: elapsed };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.addLog('error', msg);
            return { ok: false, error: msg, elapsedMs: Date.now() - startAt };
        }
    }

    // --------------------------------------------------
    // 汎用 POST (JSON)
    // --------------------------------------------------
    async post<T>(path: string, body: unknown): Promise<ServerResult<T>> {
        await this.rateLimiter.wait();
        const url = this.config.baseUrl.replace(/\/$/, '') + path;
        const startAt = Date.now();
        const bodyStr = JSON.stringify(body);

        this.addLog('send', `POST ${url}  body=${bodyStr.slice(0, 80)}${bodyStr.length > 80 ? '…' : ''}`);

        try {
            this.abortController = new AbortController();
            const timer = setTimeout(
                () => this.abortController?.abort(),
                this.config.timeoutMs
            );

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: bodyStr,
                signal: this.abortController.signal,
            });
            clearTimeout(timer);

            const elapsed = Date.now() - startAt;

            if (!res.ok) {
                const msg = `HTTP ${res.status} ${res.statusText}`;
                this.addLog('error', msg);
                return { ok: false, error: msg, statusCode: res.status, elapsedMs: elapsed };
            }

            // レスポンスボディが空の場合もある
            let data: T | undefined;
            const text = await res.text();
            if (text.trim().length > 0) {
                try { data = JSON.parse(text) as T; } catch { /* ignore */ }
            }

            this.addLog('recv', `${res.status} OK (${elapsed}ms)`);
            return { ok: true, data, statusCode: res.status, elapsedMs: elapsed };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.addLog('error', msg);
            return { ok: false, error: msg, elapsedMs: Date.now() - startAt };
        }
    }

    // --------------------------------------------------
    // ポーリング: dayInfo が更新されるまで待機
    // --------------------------------------------------
    async pollUntilNewDay(
        currentDay: number,
        options: PollOptions = {}
    ): Promise<ServerResult<DayInfo>> {
        const interval = options.intervalMs ?? 500;
        const deadline = Date.now() + (options.timeoutMs ?? 30_000);

        while (Date.now() < deadline) {
            const result = await this.fetchDayInfo();
            if (result.ok && result.data && result.data.day > currentDay) {
                return result;
            }
            await sleep(interval);
        }
        return { ok: false, error: 'pollUntilNewDay: timeout' };
    }

    /** 進行中のリクエストをキャンセル */
    cancelRequest(): void {
        this.abortController?.abort();
    }

    private addLog(type: 'send' | 'recv' | 'error', message: string): void {
        this.logs.push({ ts: Date.now(), type, message });
        if (this.logs.length > 50) this.logs.shift();
        onLog?.(type, message);
    }
}

// -------------------------------------------------------
// グローバルログコールバック (UIに通知用)
// -------------------------------------------------------
let onLog: ((type: 'send' | 'recv' | 'error', message: string) => void) | null = null;

export function setLogCallback(
    cb: (type: 'send' | 'recv' | 'error', message: string) => void
): void {
    onLog = cb;
}

// -------------------------------------------------------
// デフォルトクライアントのシングルトン
// -------------------------------------------------------
export const serverClient = new ServerClient({
    baseUrl: 'http://localhost:8080',
    teamId: 0,
    timeoutMs: 5000,
});
