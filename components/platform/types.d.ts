export type MaybePromise<T> = T | Promise<T>

export type PlatformName = string
export type PlatformChatType = 'group' | 'private' | 'channel' | string
export type PlatformUserId = string
export type PlatformChatId = string
export type PlatformMessageId = string
export type PlatformMessageInput = string | number | boolean | PhiSegment | PlatformMessageInput[] | null | undefined
export type PlatformMessageOutput = any

export interface PhiImageSegment {
    __phiSegment: true
    type: 'image'
    data: unknown
}

export interface PhiAtSegment {
    __phiSegment: true
    type: 'at'
    userId: PlatformUserId
}

export interface PhiMarkdownSegment {
    __phiSegment: true
    type: 'markdown'
    text: string
}

export interface PhiTextSegment {
    __phiSegment: true
    type: 'text'
    text: string
}

export type PhiSegment = PhiImageSegment | PhiAtSegment | PhiMarkdownSegment | PhiTextSegment

export interface PlatformSegment {
    image(data: unknown): PlatformMessageOutput | PhiImageSegment
    at(userId: PlatformUserId): PlatformMessageOutput | PhiAtSegment
    markdown(text: string): PlatformMessageOutput | PhiMarkdownSegment
    text(text: string): PlatformMessageOutput | PhiTextSegment
    [key: string]: unknown
}

export interface PlatformLogger {
    mark(...args: unknown[]): void
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
    debug(...args: unknown[]): void
    green(text: unknown): unknown
    red(text: unknown): unknown
    [key: string]: unknown
}

export interface RedisExpireOptions {
    EX?: number
    PX?: number
    [key: string]: unknown
}

export interface RedisScanOptions {
    MATCH?: string
    COUNT?: number
    [key: string]: unknown
}

export interface RedisZSetItem {
    score: number
    value: string
}

export interface KoishiDatabaseRedisOptions {
    keyValueTable?: string
    zsetTable?: string
    autoExtendModel?: boolean
}

export interface PlatformRedis {
    get(key: string): Promise<string | null>
    set(key: string, value: unknown, options?: RedisExpireOptions): Promise<unknown>
    del(...keys: Array<string | string[]>): Promise<number>
    keys(pattern?: string): Promise<string[]>
    scan(cursor?: number | string, options?: RedisScanOptions): Promise<{ cursor: number, keys: string[] }>
    ttl(key: string): Promise<number>
    zAdd(key: string, item: RedisZSetItem): Promise<number>
    zRem(key: string, value: string): Promise<number>
    zRank(key: string, value: string): Promise<number | null>
    zScore(key: string, value: string): Promise<number | null>
    zRange(key: string, min: number, max: number, mode?: string): Promise<string[]>
    zCount(key: string, min: number, max: number): Promise<number>
    zCard(key: string): Promise<number>
}

export interface PlatformBotConfig {
    [key: string]: unknown
}

export interface PlatformGroupLike {
    pickMember?(userId: PlatformUserId): MaybePromise<PlatformMemberLike | null>
    recallMsg?(messageId: PlatformMessageId): MaybePromise<unknown>
    makeForwardMsg?(messages: PlatformForwardMessage[]): MaybePromise<PlatformMessageOutput>
    sendFile?(file: string | Buffer, folder?: string, filename?: string): MaybePromise<unknown>
    fs?: {
        upload?(file: string | Buffer, folder?: string, filename?: string): MaybePromise<unknown>
    }
    [key: string]: unknown
}

export interface PlatformFriendLike {
    sendMsg?(message: PlatformMessageOutput): MaybePromise<unknown>
    recallMsg?(messageId: PlatformMessageId): MaybePromise<unknown>
    sendFile?(file: string | Buffer, filename?: string): MaybePromise<unknown>
    makeForwardMsg?(messages: PlatformForwardMessage[]): MaybePromise<PlatformMessageOutput>
    [key: string]: unknown
}

export interface PlatformMemberLike {
    sendMsg?(message: PlatformMessageOutput): MaybePromise<unknown>
    [key: string]: unknown
}

export interface PlatformBotLike {
    nickname?: string
    adapter?: { name?: string } | string
    pickMember?(groupId: PlatformChatId, userId: PlatformUserId): MaybePromise<PlatformMemberLike | null>
    sendFriendMsg?(botId: PlatformUserId | undefined, userId: PlatformUserId, message: PlatformMessageOutput): MaybePromise<unknown>
    makeForwardMsg?(messages: PlatformForwardMessage[]): MaybePromise<PlatformMessageOutput>
    sleep?(ms: number): Promise<void>
    download?(url: string, file: string, opts?: unknown): MaybePromise<unknown>
    restart?(): MaybePromise<unknown>
    [key: string]: unknown
}

export interface PlatformEvent {
    msg: string
    user_id: PlatformUserId
    group_id?: PlatformChatId
    self_id?: PlatformUserId
    isGroup: boolean
    isPrivate: boolean
    group?: PlatformGroupLike
    friend?: PlatformFriendLike
    bot?: PlatformBotLike
    platform?: PlatformName
    userId?: PlatformUserId
    chatId?: PlatformChatId
    groupId?: PlatformChatId
    chatType?: PlatformChatType
    text?: string
    logFnc?: string
    reply?(msg?: PlatformMessageInput, quote?: boolean, data?: Record<string, unknown>): MaybePromise<any>
    [key: string]: unknown
}

export interface PlatformReplyOptions {
    quote?: boolean
    rawReply?: (msg?: PlatformMessageOutput, quote?: boolean, data?: Record<string, unknown>) => MaybePromise<unknown>
    [key: string]: unknown
}

export interface PlatformForwardMessage {
    message: PlatformMessageOutput | PlatformMessageInput
    nickname?: string
    user_id?: PlatformUserId
    [key: string]: unknown
}

export interface PlatformRule {
    reg: string | RegExp
    fnc: string
    event?: string
    log?: boolean
    permission?: 'master' | 'owner' | 'admin' | 'all' | string
    [key: string]: unknown
}

export interface PlatformTask {
    name?: string
    fnc?: string
    cron?: string
    log?: boolean
    [key: string]: unknown
}

export interface PlatformHandler {
    key?: string
    fn?: (...args: unknown[]) => unknown
    [key: string]: unknown
}

export interface PlatformPluginConfig {
    name?: string
    dsc?: string
    handler?: PlatformHandler
    namespace?: string
    event?: string
    priority?: number
    task?: PlatformTask
    rule?: PlatformRule[]
    [key: string]: unknown
}

export interface PlatformPluginBase {
    name?: string
    dsc?: string
    event?: string
    priority?: number
    task?: PlatformTask
    rule?: PlatformRule[]
    e?: PlatformEvent
    reply?(msg?: PlatformMessageInput, quote?: boolean, data?: Record<string, unknown>): MaybePromise<unknown>
    setContext?(...args: unknown[]): MaybePromise<unknown>
    finish?(...args: unknown[]): MaybePromise<unknown>
    [key: string]: unknown
}

export type PlatformPluginBaseConstructor = new (config?: PlatformPluginConfig) => PlatformPluginBase

export interface PlatformRendererConfig {
    id?: string
    type?: string
    render?: string
    [key: string]: unknown
}

export interface PlatformRendererBase {
    id?: string
    type?: string
    render?: (...args: unknown[]) => unknown
    [key: string]: unknown
}

export type PlatformRendererBaseConstructor = new (config?: PlatformRendererConfig) => PlatformRendererBase

export interface PlatformAdapter {
    name: PlatformName
    PluginBase: PlatformPluginBaseConstructor
    RendererBase: PlatformRendererBaseConstructor
    redis: PlatformRedis
    rootPath: string
    logger: PlatformLogger
    segment: PlatformSegment
    getBotConfig(): PlatformBotConfig
    getPackageVersion(): string
    getBotNickname(e?: PlatformEvent): string
    getAdapterName(e?: PlatformEvent): string
    isBotReady(): boolean
    toPlatformMessage(message: PlatformMessageInput): PlatformMessageOutput
    wrapEvent<T extends PlatformEvent | null | undefined>(e: T): T extends PlatformEvent ? T & PlatformEvent : T
    cloneEvent<T extends PlatformEvent>(e: T, patch?: Partial<PlatformEvent>): T & PlatformEvent
    reply(e: PlatformEvent, msg?: PlatformMessageInput, options?: PlatformReplyOptions): Promise<unknown>
    sendWithAt(e: PlatformEvent, msg: PlatformMessageInput, quote?: boolean, data?: Record<string, unknown>): Promise<unknown>
    pickMember(e: PlatformEvent, userId: PlatformUserId): Promise<PlatformMemberLike | null>
    sendPrivate(e: PlatformEvent, msg: PlatformMessageInput): Promise<unknown>
    relpyPrivate(userId: PlatformUserId, msg: PlatformMessageInput, botId?: PlatformUserId): MaybePromise<unknown>
    recall(e: PlatformEvent, sentMessage: unknown): Promise<unknown>
    makeForwardMsg(e: PlatformEvent, msg?: PlatformMessageInput[], dec?: string): Promise<PlatformMessageOutput>
    sleep(ms: number): Promise<void>
    downFile(url: string, file: string, opts?: unknown): MaybePromise<unknown>
    mkdirs(dirname: string): boolean
    uploadFile(e: PlatformEvent, file: string | Buffer, filename?: string): Promise<unknown>
    restartBot(e?: PlatformEvent): Promise<unknown>
    [key: string]: unknown
}

declare global {
    var Bot: PlatformBotLike | undefined
    var logger: Partial<PlatformLogger> | undefined
    var redis: PlatformRedis | undefined
    var segment: Partial<PlatformSegment> | undefined
}
