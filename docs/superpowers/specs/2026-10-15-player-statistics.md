# Player statistics scope

**Status: implemented; production database verification pending.** The code is deployed, but the release audit found missing Pasalo tables in production. Verify and apply the committed Pasalo and player migrations before treating these features as available. The MVP includes rosters, invitations, private history, attendance, and match statistics.

## Purpose and boundaries

Players can optionally list booking participants. Registered players can later see where they played and review their attendance and match results. Booking remains possible without a roster. Guests do not need accounts, email addresses, or mobile numbers. A booking reserves court time; it does not establish attendance, a played match, or a win.

## Optional roster

The booking holder can add guests by nickname and share invitations with registered players. A registered player must accept an invitation before their account joins the roster; the holder cannot attach arbitrary accounts. Invitations grant participation access, not booking ownership or payment control. Players may decline or leave before the session. Guest nicknames identify entries within that booking, not unique people across bookings. Repeated nicknames must remain separate entries.

The holder may join their own roster, but booking ownership alone does not count as participation. An optional, self-described skill level such as beginner, intermediate, or advanced helps participants describe themselves. It is not a calculated rating or an official competitive credential.

Roster membership freezes at the scheduled start to keep participation consent stable during play. Invitation links expire at the scheduled start or after seven days, whichever comes first. The roster and open invitations together are limited to 32 places.

## Attendance and personal history

After a booking becomes completed and its scheduled end passes, each accepted registered player can confirm that they attended or mark that they did not attend. Only their confirmed attendance adds a session to their personal history. Cancelled bookings, expired holds, future reservations, and absent players contribute no played sessions. A completed booking without attendance confirmation remains a reservation record.

History shows the date, venue, court, and confirmed session count. Venue and court totals derive from those sessions. Reserved duration must not be presented as actual playing time. Guest attendance may be recorded as reported by the holder; it creates no account history or inferred identity. Guests can remain guests permanently.

## Matches and statistics

A session can contain several matches. Each match records singles or doubles, its participant entries, team membership, optional score, and an explicit winner or unfinished outcome. Singles requires one player per side; doubles requires two. The same player cannot occupy both sides. Attendance confirmation is required before a registered player's match can affect their totals.

Every registered participant must accept the same result revision, including at least one opposing registered player, before the result is labelled peer-confirmed. A game with no registered opponent remains self-reported. Guests never need to register to make a match record possible. Pending, disputed, and unfinished results do not affect confirmed wins, losses, or win rate. Self-reported results have separate, clearly labelled totals. Win rate uses decided matches only and shows no percentage when there are none. No skill rating, leaderboard rank, or official rating is inferred.

## Privacy and corrections

Profiles, attendance history, and statistics are private by default. Accepted participants can see the minimum roster and match information needed for their session, without exposing another player's wider history or contact details. Guest nicknames are not published. Booking holders can manage their roster but cannot confirm attendance or results for another registered player.

Players can correct attendance and propose result corrections. Any changed result requires fresh confirmations. A dispute removes that result from confirmed totals until all required participants accept a resolution. Keep revision and dispute records; do not silently overwrite claims. Declined invitations and revoked links must grant no access.

## Data relationships and Pasalo

A booking has roster entries and a completed play session; the session has attendance records and multiple matches. Each roster entry references either an accepted registered user or a local guest nickname. Matches reference roster entries, while attendance and result confirmations reference their actor and revision. Personal summaries derive from eligible records rather than editable counters.

Pasalo is a separate whole-booking transfer with no venue approval. Its first release uses direct GCASH/MAYA payment confirmed by the seller. On transfer, preserve other accepted roster members and guest entries, exchange holder management access, and revoke or reissue pending invitation links under the new holder. The buyer must opt into participation; neither payment nor transfer proves attendance. Retain the seller as an ordinary participant only by explicit roster choice. Ownership changes must never reassign historical attendance, match authorship, or confirmations.

Choosing Add myself before a transfer is an explicit participation choice and preserves the seller as an ordinary participant. The seller can leave before play starts; the buyer receives holder permissions without automatically becoming a player.

## Delivery phases and verification

The MVP includes the optional roster, accepted invitations, private attendance history, singles/doubles results, confirmation labels, basic totals, corrections, and Pasalo access handling. Later phases may add voluntary profile sharing, richer trends, tournament formats, and consent-based linking of previous guest entries. Public discovery and external rating integrations require separate scope.

Meaningful tests cover guest-only rosters without contact fields; invitation impersonation and revocation; completion without attendance; cancellations and absences; multiple matches and invalid teams; guest-result labels; duplicate submissions; correction/dispute recalculation; privacy across accounts; and transfers preserving other participants while removing the seller's holder permissions.
