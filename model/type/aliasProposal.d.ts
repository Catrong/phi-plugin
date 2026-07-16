import type { PlatformEvent, PlatformUserId } from '../../components/platform/types.js'

export type AliasProposalStatus =
    | 'submitted'
    | 'rejected_private'
    | 'public_review_requested'
    | 'public_voting'
    | 'vote_passed'
    | 'approved'
    | 'public_review_denied'
    | 'rejected_final'

export type AliasVoteValue = 1 | -1 | 0

export interface AliasProposalRecord {
    id: string
    alias: string
    songId: string
    status: AliasProposalStatus
    source?: 'web' | 'bot'
    note?: string | null
    createdAt: string
    updatedAt: string
    votingStartedAt?: string | null
    votingEndsAt?: string | null
    resolvedAt?: string | null
    votesUp: number
    votesDown: number
    voteScore: number
    myVote?: 1 | -1 | null
    publicReviewReason?: string | null
    publicReviewStatus?: 'pending' | 'allowed' | 'denied' | null
    publicReviewDecisionNote?: string | null
}

export interface AliasNotificationBinding {
    clientId: string
    aliasNotificationKey: string
    aliasNotificationKeyUpdatedAt: string
    botId: PlatformUserId | null
}

export interface AliasNotificationBindingWithUser extends AliasNotificationBinding {
    userId: PlatformUserId
}

export interface AliasBotContext {
    clientId: string
    notificationKey: string
}

export interface AliasBotSessionResponse {
    notificationKey: string
    keyUpdatedAt: string
}

export interface AliasProposalEnvelope extends AliasBotSessionResponse {
    proposal: AliasProposalRecord
}

export interface AliasProposalListResponse {
    items: AliasProposalRecord[]
}

export interface AliasNotificationPayload {
    proposalId?: string
    alias?: string
    songId?: string
    status?: AliasProposalStatus | string
    votesUp?: number
    votesDown?: number
}

export interface AliasNotificationItem {
    id: string
    proposalId: string
    type: string
    payload?: AliasNotificationPayload
    createdAt?: string
}

export interface AliasNotificationClientResult {
    clientId: string
    items: AliasNotificationItem[]
}

export interface AliasNotificationPollResponse {
    clients: AliasNotificationClientResult[]
}

export interface AliasProposalCreateInput {
    songId: string
    alias: string
    note?: string
}

export type AliasBotEvent = PlatformEvent & {
    user_id: PlatformUserId
    self_id?: PlatformUserId
}
