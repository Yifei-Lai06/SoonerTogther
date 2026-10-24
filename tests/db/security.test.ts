// Database authorization + workflow tests. Every step runs as a specific user
// against the real migrations (see harness.ts). Run with `npm run test:db`.

import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { as, asService, createDb, createUser, errorOf, type Db } from "./harness.ts";

let db: Db;
let alex: string, maya: string, sam: string, ou: string;

async function onboard(uid: string, slots: string[]) {
  await as(db, uid, `update profiles set onboarded = true, modes = '{discussion,teaching}' where id = auth.uid()`);
  await as(db, uid, `update private_profiles set availability = $1 where user_id = auth.uid()`, [slots]);
}

async function xpOf(uid: string) {
  const [row] = await asService<{ xp: number; ledger: number }>(
    db,
    `select p.xp, coalesce((select sum(amount) from xp_events where user_id = p.id), 0)::int as ledger from profiles p where id = $1`,
    [uid],
  );
  return row;
}

before(async () => {
  db = await createDb();
  alex = await createUser(db, { name: "Alex Rivera" });
  maya = await createUser(db, { name: "Maya Chen" });
  sam = await createUser(db, { name: "Sam Okafor" });
  ou = await createUser(db, { name: "Boomer Sooner", email: "boomer@ou.edu" });
  await onboard(alex, ["mon-afternoon", "wed-afternoon"]);
  await onboard(maya, ["wed-afternoon", "thu-evening"]);
  await onboard(sam, ["fri-morning"]);
  await as(db, maya, `insert into tutor_subjects (user_id, course_id, topics, experience) values (auth.uid(), 'MATH 1914', '{Chain Rule}', 'Took it last year')`);
  await as(db, alex, `insert into help_needs (user_id, course_id, topics) values (auth.uid(), 'MATH 1914', '{Chain Rule}')`);
});

describe("sign-up", () => {
  test("a profile and private row are created for every new user", async () => {
    const rows = await asService(db, `select id from profiles`);
    assert.equal(rows.length, 4);
    const priv = await asService(db, `select user_id from private_profiles`);
    assert.equal(priv.length, 4);
  });
  test("OU badge only for a provider-confirmed @ou.edu address", async () => {
    const [p] = await asService<{ ou_verified: boolean }>(db, `select ou_verified from profiles where id = $1`, [ou]);
    assert.equal(p.ou_verified, true);
    const unconfirmed = await createUser(db, { name: "Fake", email: "fake@ou.edu", confirmed: false });
    const [q] = await asService<{ ou_verified: boolean }>(db, `select ou_verified from profiles where id = $1`, [unconfirmed]);
    assert.equal(q.ou_verified, false);
  });
});

describe("profile privacy", () => {
  test("anonymous visitors can't read profiles", async () => {
    assert.match(await errorOf(as(db, null, `select * from profiles`)), /permission denied/);
  });
  test("users can't edit someone else's profile", async () => {
    await as(db, alex, `update profiles set bio = 'hacked' where id = $1`, [maya]);
    const [p] = await asService<{ bio: string }>(db, `select bio from profiles where id = $1`, [maya]);
    assert.equal(p.bio, "");
  });
  test("users can't give themselves XP, an OU badge, or first-timer status", async () => {
    assert.match(await errorOf(as(db, alex, `update profiles set xp = 9999 where id = auth.uid()`)), /permission denied/);
    assert.match(await errorOf(as(db, alex, `update profiles set ou_verified = true where id = auth.uid()`)), /permission denied/);
    assert.match(
      await errorOf(as(db, alex, `insert into xp_events (user_id, key, amount, reason) values (auth.uid(), 'x', 50, 'x')`)),
      /permission denied/,
    );
  });
  test("availability and learning needs are private", async () => {
    const avail = await as(db, alex, `select * from private_profiles`);
    assert.equal(avail.length, 1);
    const needs = await as(db, maya, `select * from help_needs`);
    assert.equal(needs.length, 0);
  });
  test("internal helpers and AI quota are not callable by users", async () => {
    assert.match(await errorOf(as(db, alex, `select consume_ai_quota(auth.uid(), 1000, 1000)`)), /permission denied/);
    assert.match(await errorOf(as(db, alex, `select private.award_xp(auth.uid(), 'k', 50, 'r')`)), /permission denied/);
  });
});

let requestId: string;

describe("matching and sessions", () => {
  test("you can't match with yourself", async () => {
    assert.match(
      await errorOf(as(db, alex, `select request_session($1, 'tutor', 'MATH 1914', '{}', 'discussion', '')`, [alex])),
      /cannot_match_self/,
    );
  });
  test("tutor requests require someone who tutors the course", async () => {
    assert.match(
      await errorOf(as(db, alex, `select request_session($1, 'tutor', 'MATH 1914', '{}', 'discussion', '')`, [sam])),
      /not_a_tutor_for_course/,
    );
  });
  test("request → only participants can see it → duplicates blocked", async () => {
    const [r] = await as<{ id: string }>(
      db,
      alex,
      `select request_session($1, 'tutor', 'MATH 1914', '{Chain Rule,NotATopic}', 'discussion', 'help!') as id`,
      [maya],
    );
    requestId = r.id;
    const [row] = await asService<{ topics: string[] }>(db, `select topics from match_requests where id = $1`, [requestId]);
    assert.deepEqual(row.topics, ["Chain Rule"], "unknown topics are dropped server-side");
    assert.equal((await as(db, sam, `select * from match_requests`)).length, 0);
    assert.equal((await as(db, maya, `select * from match_requests`)).length, 1);
    assert.match(
      await errorOf(as(db, alex, `select request_session($1, 'tutor', 'MATH 1914', '{}', 'discussion', '')`, [maya])),
      /already_open/,
    );
    const notes = await as(db, maya, `select * from notifications`);
    assert.equal(notes.length, 1);
  });
  test("only the recipient can accept", async () => {
    assert.match(await errorOf(as(db, alex, `select respond_request($1, true)`, [requestId])), /not_found/);
    assert.match(await errorOf(as(db, sam, `select respond_request($1, true)`, [requestId])), /not_found/);
    await as(db, maya, `select respond_request($1, true)`, [requestId]);
    assert.match(await errorOf(as(db, maya, `select respond_request($1, true)`, [requestId])), /already_answered/);
  });
  test("accepting opens exactly one private conversation", async () => {
    const convs = await as(db, alex, `select * from conversations where kind = 'direct'`);
    assert.equal(convs.length, 1);
    assert.equal((await as(db, sam, `select * from conversations where kind = 'direct'`)).length, 0);
  });
  test("scheduling only accepts a mutually free slot", async () => {
    assert.match(await errorOf(as(db, alex, `select schedule_session($1, 'mon-afternoon')`, [requestId])), /slot_not_mutual/);
    assert.match(await errorOf(as(db, sam, `select schedule_session($1, 'wed-afternoon')`, [requestId])), /not_found/);
    await as(db, alex, `select schedule_session($1, 'wed-afternoon')`, [requestId]);
  });
  test("completion needs both confirmations; XP once; first-timer bonus", async () => {
    await as(db, alex, `select confirm_session($1)`, [requestId]);
    assert.equal((await xpOf(alex)).xp, 0, "no XP after one confirmation");
    await as(db, alex, `select confirm_session($1)`, [requestId]); // repeat is harmless
    assert.match(await errorOf(as(db, sam, `select confirm_session($1)`, [requestId])), /not_found/);
    assert.match(
      await errorOf(as(db, alex, `insert into session_confirmations (session_id, user_id) select id, $1 from study_sessions`, [maya])),
      /permission denied/,
      "can't forge the other person's confirmation",
    );
    await as(db, maya, `select confirm_session($1)`, [requestId]);
    assert.deepEqual(await xpOf(alex), { xp: 30, ledger: 30 });
    assert.deepEqual(await xpOf(maya), { xp: 50, ledger: 50 }, "30 + 20 first-time learner bonus");
    assert.match(await errorOf(as(db, maya, `select confirm_session($1)`, [requestId])), /not_confirmable/);
    assert.equal((await xpOf(maya)).xp, 50);
    const badges = await as(db, alex, `select badge_id from achievements where user_id = $1`, [maya]);
    assert.deepEqual(badges, [{ badge_id: "first-helper" }]);
  });
  test("feedback is private, once only, and connections need both yeses", async () => {
    await as(db, alex, `select submit_feedback($1, true, true, true)`, [requestId]);
    assert.equal((await xpOf(maya)).xp, 60, "+10 helpful feedback");
    assert.match(await errorOf(as(db, alex, `select submit_feedback($1, true, true, true)`, [requestId])), /already_submitted/);
    assert.equal((await xpOf(maya)).xp, 60);
    assert.equal((await as(db, maya, `select * from session_feedback`)).length, 0, "Maya can't read Alex's feedback");
    assert.equal((await as(db, alex, `select * from connections`)).length, 0, "one-sided interest creates nothing");
    await as(db, maya, `select submit_feedback($1, false, true, true)`, [requestId]);
    assert.equal((await as(db, alex, `select * from connections`)).length, 1);
    assert.equal((await xpOf(alex)).xp, 30, "no helpful XP when Maya said not helpful");
  });
});

describe("messaging", () => {
  let conv: string;
  test("members can send and read; outsiders can't", async () => {
    [{ id: conv }] = await as<{ id: string }>(db, alex, `select id from conversations where kind = 'direct'`);
    await as(db, alex, `select send_message($1, 'hey Maya!')`, [conv]);
    const inbox = await as<{ unread: number; other_name: string }>(db, maya, `select * from my_conversations() where kind = 'direct'`);
    assert.equal(inbox[0].unread, 1);
    assert.equal(inbox[0].other_name, "Alex Rivera");
    assert.ok(!JSON.stringify(inbox).includes("@"), "no emails in the inbox");
    await as(db, maya, `select mark_conversation_read($1)`, [conv]);
    assert.equal((await as<{ unread: number }>(db, maya, `select unread from my_conversations() where kind = 'direct'`))[0].unread, 0);
    assert.equal((await as(db, sam, `select * from messages`)).length, 0);
    assert.match(await errorOf(as(db, sam, `select send_message($1, 'intruder')`, [conv])), /not_found/);
    assert.match(
      await errorOf(as(db, alex, `insert into messages (conversation_id, sender_id, body) values ($1, $2, 'forged')`, [conv, maya])),
      /permission denied/,
    );
    assert.match(
      await errorOf(as(db, sam, `insert into conversation_members (conversation_id, user_id) values ($1, auth.uid())`, [conv])),
      /permission denied/,
    );
  });
  test("length limits and blocking", async () => {
    assert.match(await errorOf(as(db, alex, `select send_message($1, $2)`, [conv, "x".repeat(2001)])), /invalid_length/);
    assert.match(await errorOf(as(db, alex, `select send_message($1, '   ')`, [conv])), /invalid_length/);
    await as(db, maya, `select block_user($1, true)`, [alex]);
    assert.match(await errorOf(as(db, alex, `select send_message($1, 'still there?')`, [conv])), /unavailable/);
    assert.match(
      await errorOf(as(db, alex, `select request_session($1, 'partner', 'MATH 1914', '{}', 'talk', '')`, [maya])),
      /unavailable|already_open/,
    );
    await as(db, maya, `select block_user($1, false)`, [alex]);
    await as(db, alex, `select send_message($1, 'thanks for unblocking')`, [conv]);
  });
});

describe("study circles", () => {
  let circle: string, challenge: string;
  test("join once, capacity enforced, circle chat membership follows", async () => {
    [{ id: circle }] = await as<{ id: string }>(db, alex, `select id from circles where name = 'Calculus Survival Circle'`);
    await as(db, alex, `select join_circle($1)`, [circle]);
    await as(db, alex, `select join_circle($1)`, [circle]);
    const members = await asService(db, `select * from circle_members where circle_id = $1`, [circle]);
    assert.equal(members.length, 1);
    const chats = await as(db, alex, `select * from my_conversations() where kind = 'circle'`);
    assert.equal(chats.length, 1);
    assert.match(await errorOf(as(db, alex, `insert into circle_members (circle_id, user_id) values ($1, $2)`, [circle, sam])), /permission denied/);
  });
  test("weekly check-in pays once; milestone at 3 members; no farming", async () => {
    await as(db, alex, `select attend_circle($1)`, [circle]);
    await as(db, alex, `select attend_circle($1)`, [circle]);
    assert.equal((await xpOf(alex)).xp, 45);
    assert.match(await errorOf(as(db, sam, `select attend_circle($1)`, [circle])), /not_a_member/);

    await as(db, maya, `select join_circle($1)`, [circle]);
    await as(db, sam, `select join_circle($1)`, [circle]);
    [{ id: challenge }] = await as<{ id: string }>(db, alex, `select id from circle_challenges where circle_id = $1 order by position limit 1`, [circle]);
    await as(db, alex, `select toggle_challenge($1)`, [challenge]);
    await as(db, maya, `select toggle_challenge($1)`, [challenge]);
    assert.equal((await xpOf(alex)).xp, 45);
    await as(db, sam, `select toggle_challenge($1)`, [challenge]);
    assert.equal((await xpOf(alex)).xp, 70, "+25 milestone");
    await as(db, sam, `select toggle_challenge($1)`, [challenge]);
    await as(db, sam, `select toggle_challenge($1)`, [challenge]);
    assert.equal((await xpOf(alex)).xp, 70, "untoggle/retoggle can't re-award");
    assert.deepEqual(await xpOf(sam), { xp: 25, ledger: 25 });
  });
  test("leaving removes the circle chat", async () => {
    await as(db, sam, `select leave_circle($1)`, [circle]);
    assert.equal((await as(db, sam, `select * from my_conversations() where kind = 'circle'`)).length, 0);
  });
});

describe("AI quota and feedback", () => {
  test("per-user and global limits are enforced by the database", async () => {
    assert.equal((await asService<{ r: string }>(db, `select consume_ai_quota($1, 2, 100) as r`, [alex]))[0].r, "ok");
    assert.equal((await asService<{ r: string }>(db, `select consume_ai_quota($1, 2, 100) as r`, [alex]))[0].r, "ok");
    assert.equal((await asService<{ r: string }>(db, `select consume_ai_quota($1, 2, 100) as r`, [alex]))[0].r, "user_limit");
    assert.equal((await asService<{ r: string }>(db, `select consume_ai_quota($1, 2, 2) as r`, [maya]))[0].r, "global_limit");
    assert.equal((await as<{ n: number }>(db, alex, `select ai_usage_today() as n`))[0].n, 2);
  });
  test("AI chats are private to their owner", async () => {
    const [c] = await as<{ id: string }>(db, alex, `insert into ai_conversations (user_id, title) values (auth.uid(), 'Arrays') returning id`);
    await as(db, alex, `insert into ai_messages (conversation_id, user_id, role, content) values ($1, auth.uid(), 'user', 'hi')`, [c.id]);
    assert.equal((await as(db, maya, `select * from ai_messages`)).length, 0);
    assert.match(
      await errorOf(as(db, maya, `insert into ai_messages (conversation_id, user_id, role, content) values ($1, auth.uid(), 'user', 'x')`, [c.id])),
      /row-level security/,
    );
  });
  test("feedback is write-only for users", async () => {
    await as(db, alex, `insert into feedback (user_id, category, message, rating) values (auth.uid(), 'bug', 'button broken', 4)`);
    assert.match(await errorOf(as(db, alex, `select * from feedback`)), /permission denied/);
    assert.match(
      await errorOf(as(db, alex, `insert into feedback (user_id, category, message) values ($1, 'bug', 'spoof')`, [maya])),
      /row-level security/,
    );
  });
});

describe("OU verification codes", () => {
  test("only the server can store/check codes; wrong codes are counted; right code verifies", async () => {
    assert.match(await errorOf(as(db, alex, `select ou_code_store(auth.uid(), 'a@ou.edu', 'h')`)), /permission denied/);
    await asService(db, `select ou_code_store($1, 'Alex@OU.edu', 'good')`, [alex]);
    assert.equal((await asService<{ r: string }>(db, `select ou_code_check($1, 'bad') as r`, [alex]))[0].r, "wrong_code");
    assert.equal((await asService<{ r: string }>(db, `select ou_code_check($1, 'good') as r`, [alex]))[0].r, "ok");
    const [p] = await asService<{ ou_verified: boolean }>(db, `select ou_verified from profiles where id = $1`, [alex]);
    assert.equal(p.ou_verified, true);
    assert.equal((await asService<{ r: string }>(db, `select ou_code_check($1, 'good') as r`, [alex]))[0].r, "no_code", "codes are single-use");
  });
});

describe("intro + visibility (0005)", () => {
  test("users can mark the intro seen and hide profile sections — only on their own row", async () => {
    await as(db, alex, `update profiles set intro_seen_at = now(), show_xp = false where id = auth.uid()`);
    const [p] = await asService<{ seen: boolean; show_xp: boolean }>(db, `select intro_seen_at is not null as seen, show_xp from profiles where id = $1`, [alex]);
    assert.deepEqual(p, { seen: true, show_xp: false });
    await as(db, alex, `update profiles set show_xp = false where id = $1`, [maya]);
    const [q] = await asService<{ show_xp: boolean }>(db, `select show_xp from profiles where id = $1`, [maya]);
    assert.equal(q.show_xp, true);
  });
});

describe("appearance + profile photos (0006)", () => {
  test("appearance prefs save on your own row and reject invalid values", async () => {
    await as(db, alex, `update profiles set accent = 'teal', reduce_motion = true, show_doodles = false where id = auth.uid()`);
    const [p] = await asService<{ accent: string; reduce_motion: boolean }>(db, `select accent, reduce_motion from profiles where id = $1`, [alex]);
    assert.deepEqual(p, { accent: "teal", reduce_motion: true });
    assert.match(await errorOf(as(db, alex, `update profiles set accent = 'neon' where id = auth.uid()`)), /check constraint/);
  });
  test("photo URL must be your own avatar upload, your Google photo, or empty", async () => {
    const own = `https://abc123.supabase.co/storage/v1/object/public/avatars/${alex}/p1.jpg`;
    await as(db, alex, `update profiles set avatar_url = $1 where id = auth.uid()`, [own]);
    await as(db, alex, `update profiles set avatar_url = 'https://lh3.googleusercontent.com/a/abc=s96-c' where id = auth.uid()`);
    await as(db, alex, `update profiles set avatar_url = null where id = auth.uid()`);
    const someoneElses = `https://abc123.supabase.co/storage/v1/object/public/avatars/${maya}/p1.jpg`;
    assert.match(await errorOf(as(db, alex, `update profiles set avatar_url = $1 where id = auth.uid()`, [someoneElses])), /invalid_avatar_url/);
    assert.match(await errorOf(as(db, alex, `update profiles set avatar_url = 'https://evil.example/x.png' where id = auth.uid()`)), /invalid_avatar_url/);
  });
  test("storage: users upload only into their own avatars folder", async () => {
    await as(db, alex, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${alex}/photo.jpg`]);
    assert.match(
      await errorOf(as(db, alex, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${maya}/photo.jpg`])),
      /row-level security/,
    );
    assert.match(await errorOf(as(db, alex, `insert into storage.objects (bucket_id, name) values ('avatars', 'loose.jpg')`)), /row-level security/);
  });
});
