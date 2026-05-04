import mysql from "mysql2/promise";

let pool = null;

function jsonOr(val, fallback) {
  if (val == null || val === "") return fallback;
  if (Buffer.isBuffer(val)) {
    try {
      const parsed = JSON.parse(val.toString("utf8"));
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  if (Array.isArray(val)) return val;
  if (typeof val === "object" && val !== null) return fallback;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function isMysqlProfiles() {
  return pool != null;
}

export async function initMysqlProfiles() {
  const host = process.env.MYSQL_HOST;
  if (!host) {
    console.log("Profiles: using profiles.json — set MYSQL_HOST in backend/.env to use MySQL.");
    return null;
  }

  try {
    pool = mysql.createPool({
      host,
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE || "risk_radar",
      waitForConnections: true,
      connectionLimit: 10
    });
    await pool.query("SELECT 1");
    await ensureSchema();
    console.log("Profiles: using MySQL", process.env.MYSQL_DATABASE || "risk_radar");
    return pool;
  } catch (err) {
    console.warn("Profiles: MySQL connection failed, using profiles.json —", err.message);
    pool = null;
    return null;
  }
}

async function ensureSchema() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      nid VARCHAR(64) NOT NULL,
      name VARCHAR(200) NOT NULL,
      email VARCHAR(200) DEFAULT '',
      age INT NULL,
      location VARCHAR(200) DEFAULT '',
      profession VARCHAR(200) DEFAULT '',
      bio TEXT,
      interests JSON NULL,
      intents JSON NULL,
      crime_score INT NOT NULL DEFAULT 0,
      philanthropy_score INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_profiles_nid (nid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  /* No FK to profiles(id): errno 150 if an older profiles.id type (e.g. signed BIGINT) differs from profile_id. */
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS profile_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      profile_id BIGINT UNSIGNED NOT NULL,
      action_type ENUM('crime', 'philanthropy') NOT NULL,
      details TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_profile_history_profile (profile_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function toDbAge(val) {
  if (val === "" || val == null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function rowToProfile(row, history) {
  const intents = jsonOr(row.intents, ["Friendship"]);
  const interests = jsonOr(row.interests, []);
  return {
    id: String(row.id),
    nid: row.nid,
    name: row.name,
    email: row.email || "",
    age: row.age == null ? "" : Number(row.age),
    location: row.location || "",
    profession: row.profession || "",
    bio: row.bio || "",
    interests,
    intents,
    crimeScore: Number(row.crime_score || 0),
    philanthropyScore: Number(row.philanthropy_score || 0),
    history: (history || []).map((h) => ({
      type: h.action_type,
      details: h.details || "",
      date: new Date(h.created_at).toISOString()
    }))
  };
}

async function loadHistories(profileIds) {
  if (!profileIds.length) return new Map();
  const numericIds = profileIds.map((id) => (typeof id === "bigint" ? Number(id) : id));
  const placeholders = numericIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT profile_id, action_type, details, created_at
     FROM profile_history WHERE profile_id IN (${placeholders}) ORDER BY created_at ASC`,
    numericIds
  );
  const map = new Map();
  for (const id of numericIds) map.set(String(id), []);
  for (const h of rows) {
    const key = String(h.profile_id);
    const list = map.get(key) || [];
    list.push(h);
    map.set(key, list);
  }
  return map;
}

export async function mysqlListProfiles() {
  const [rows] = await pool.query("SELECT * FROM profiles ORDER BY philanthropy_score DESC, crime_score ASC, nid ASC");
  const ids = rows.map((r) => r.id);
  const historyMap = await loadHistories(ids);
  return rows.map((r) => rowToProfile(r, historyMap.get(String(r.id))));
}

export async function mysqlGetByNid(nid) {
  const [rows] = await pool.query("SELECT * FROM profiles WHERE nid = ? LIMIT 1", [nid]);
  if (!rows.length) return null;
  const row = rows[0];
  const historyMap = await loadHistories([row.id]);
  return rowToProfile(row, historyMap.get(String(row.id)));
}

export async function mysqlUpsertProfile(body) {
  const nid = String(body.nid || "");
  const name = body.name || "Unknown";
  const email = body.email ?? "";
  const age = body.age === "" || body.age == null ? null : Number(body.age);
  const location = body.location ?? "";
  const profession = body.profession ?? "";
  const bio = body.bio ?? "";
  const interests = Array.isArray(body.interests) ? body.interests : [];
  const intents = Array.isArray(body.intents) ? body.intents : body.intents ? [body.intents] : ["Friendship"];

  const [existing] = await pool.query("SELECT id, crime_score, philanthropy_score FROM profiles WHERE nid = ? LIMIT 1", [nid]);

  let crimeScore = Number(body.crimeScore ?? body.crime_score ?? 0);
  let philanthropyScore = Number(body.philanthropyScore ?? body.philanthropy_score ?? 0);
  if (existing.length) {
    if (body.crimeScore === undefined && body.crime_score === undefined) crimeScore = Number(existing[0].crime_score);
    if (body.philanthropyScore === undefined && body.philanthropy_score === undefined) {
      philanthropyScore = Number(existing[0].philanthropy_score);
    }
  }

  const interestsJson = JSON.stringify(interests);
  const intentsJson = JSON.stringify(intents);

  if (!existing.length) {
    await pool.execute(
      `INSERT INTO profiles (nid, name, email, age, location, profession, bio, interests, intents, crime_score, philanthropy_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nid, name, email, age, location, profession, bio, interestsJson, intentsJson, crimeScore, philanthropyScore]
    );
  } else {
    await pool.execute(
      `UPDATE profiles SET
        name = ?, email = ?, age = ?, location = ?, profession = ?, bio = ?,
        interests = ?, intents = ?,
        crime_score = ?, philanthropy_score = ?
       WHERE nid = ?`,
      [
        name,
        email,
        age,
        location,
        profession,
        bio,
        interestsJson,
        intentsJson,
        crimeScore,
        philanthropyScore,
        nid
      ]
    );
  }

  return mysqlGetByNid(nid);
}

export async function mysqlUpdatePartial(nid, body) {
  const current = await mysqlGetByNid(nid);
  if (!current) return null;

  const merged = {
    bio: body.bio !== undefined ? body.bio : current.bio,
    profession: body.profession !== undefined ? body.profession : current.profession,
    intents:
      body.intents !== undefined
        ? Array.isArray(body.intents)
          ? body.intents
          : [body.intents]
        : current.intents,
    email: body.email !== undefined ? body.email : current.email,
    age: body.age !== undefined ? toDbAge(body.age) : toDbAge(current.age),
    location: body.location !== undefined ? body.location : current.location,
    interests: body.interests !== undefined ? (Array.isArray(body.interests) ? body.interests : []) : current.interests
  };

  await pool.execute(
    `UPDATE profiles SET bio = ?, profession = ?, intents = ?, email = ?, age = ?, location = ?, interests = ? WHERE nid = ?`,
    [
      merged.bio,
      merged.profession,
      JSON.stringify(merged.intents),
      merged.email,
      merged.age,
      merged.location,
      JSON.stringify(merged.interests),
      nid
    ]
  );

  return mysqlGetByNid(nid);
}

export async function mysqlDeleteProfile(nid) {
  const [r] = await pool.execute("DELETE FROM profiles WHERE nid = ?", [nid]);
  return r.affectedRows > 0;
}

export async function mysqlRecordAction({ nid, name, type, details }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [found] = await conn.execute("SELECT id, crime_score, philanthropy_score FROM profiles WHERE nid = ? FOR UPDATE", [nid]);
    let profileId;

    if (!found.length) {
      const [ins] = await conn.execute(
        `INSERT INTO profiles (nid, name, email, interests, intents, crime_score, philanthropy_score)
         VALUES (?, ?, '', ?, ?, 0, 0)`,
        [nid, name, "[]", '["Friendship"]']
      );
      const raw = ins.insertId;
      profileId = raw == null ? null : typeof raw === "bigint" ? Number(raw) : raw;
      if (profileId == null || Number.isNaN(profileId)) {
        throw new Error("Insert profile failed: missing insertId");
      }
    } else {
      const rid = found[0].id;
      profileId = typeof rid === "bigint" ? Number(rid) : rid;
    }

    await conn.execute(
      "INSERT INTO profile_history (profile_id, action_type, details) VALUES (?, ?, ?)",
      [profileId, type, details || ""]
    );

    if (type === "crime") {
      await conn.execute("UPDATE profiles SET crime_score = crime_score + 1 WHERE id = ?", [profileId]);
    } else {
      await conn.execute("UPDATE profiles SET philanthropy_score = philanthropy_score + 1 WHERE id = ?", [profileId]);
    }

    await conn.commit();
    return mysqlGetByNid(nid);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
