/** Browser-safe player payloads. Booking dates use Manila civil timestamps; audit dates are actual UTC. */
export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type Attendance = "UNKNOWN" | "ATTENDED" | "ABSENT";
export type MatchFormat = "SINGLES" | "DOUBLES";
export type Winner = "A" | "B" | "UNFINISHED";
export type Decision = "CONFIRMED" | "DISPUTED";
export type Verification = "PEER_CONFIRMED" | "SELF_REPORTED" | "PENDING" | "DISPUTED" | "UNFINISHED";

export interface PlayerProfileView { displayName: string; skillLevel: SkillLevel | null }
export interface ParticipantView { id: string; nickname: string; isGuest: boolean; isMe: boolean; attendance: Attendance }
export interface MatchInput { format: MatchFormat; teamA: string[]; teamB: string[]; winner: Winner; scoreA?: number | null; scoreB?: number | null; note?: string }
export interface RevisionView { number: number; format: MatchFormat; teamA: ParticipantView[]; teamB: ParticipantView[]; winner: Winner; scoreA: number | null; scoreB: number | null; note: string | null; createdAt: string; votes: { nickname: string; decision: Decision }[] }
export interface MatchView extends RevisionView { id: string; verification: Verification; canEdit: boolean; canVote: boolean; canDispute: boolean; myDecision: Decision | null; revisionCount: number }
export interface SessionBookingView { id: string; venueName: string; courtName: string; startsAt: string; endsAt: string; status: string }
export interface RosterView {
  booking: SessionBookingView; isHolder: boolean; canEdit: boolean; canInvite: boolean; canRecord: boolean; canConfirmAttendance: boolean;
  selfParticipantId: string | null; participants: ParticipantView[];
  invitations: { id: string; label: string | null; status: "OPEN" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED"; expiresAt: string }[];
  matches: MatchView[];
}
export interface ResultTotals { wins: number; losses: number; matches: number; winRate: number | null }
export interface PlayerTotals { sessions: number; venues: number; courts: number; confirmed: ResultTotals; selfReported: ResultTotals }
export interface CourtStats { venueId: string; venueName: string; courtId: string; courtName: string; sessions: number; confirmed: ResultTotals; selfReported: ResultTotals }
export interface PlayerSessionView { participantId: string; booking: SessionBookingView; attendance: Attendance; canConfirmAttendance: boolean }
export interface PlayerDashboardView { profile: PlayerProfileView; totals: PlayerTotals; courts: CourtStats[]; history: PlayerSessionView[]; nextCursor: string | null; pending: PlayerSessionView[]; pendingNextCursor: string | null }
export interface InvitationView { venueName: string; courtName: string; startsAt: string; endsAt: string; expiresAt: string }
