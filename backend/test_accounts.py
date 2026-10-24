import os
import tempfile
import time
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.accounts import COOKIE
from app.main import app
from app.storage import connection, initialize_database


class AccountStorageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {
            "CARECOMPASS_DB_PATH": str(Path(self.directory.name) / "accounts.sqlite3"),
        })
        self.env.start()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.env.stop()
        self.directory.cleanup()

    def register(self, email="one@example.com"):
        response = self.client.post("/api/auth/register", json={
            "email": email, "name": "Test Person", "password": "OnlyForTests123!",
        })
        self.assertEqual(response.status_code, 201, response.text)
        return response

    def chat(self):
        return {
            "id": str(uuid.uuid4()), "messages": [{"role": "user", "content": "oxygen 88"}],
            "patientContext": {"medical_history": "test only", "vitals": {"oxygen_percent": 88}},
            "recipient": "other", "emergency": True,
            "location": {"lat": 28.5, "lng": 77.2},
            "selectedCaregiverId": "demo-example",
            "result": {"care_type": "emergency_112", "urgency": "emergency"},
        }

    def test_registration_validation_hashes_and_cookie_flags(self):
        self.assertEqual(self.client.get("/api/account").status_code, 401)
        self.assertEqual(self.client.post("/api/auth/register", json={
            "email": "invalid", "name": " ", "password": "short",
        }).status_code, 422)
        response = self.register("One@Example.com")
        self.assertEqual(response.json()["profile"]["email"], "one@example.com")
        cookie = response.headers["set-cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=strict", cookie)
        self.assertIn("Path=/api", cookie)
        with connection() as db:
            stored = db.execute("SELECT password_hash FROM users").fetchone()[0]
            token = db.execute("SELECT token_hash FROM sessions").fetchone()[0]
        self.assertTrue(stored.startswith("pbkdf2_sha256$600000$"))
        self.assertNotIn("OnlyForTests123!", stored)
        self.assertNotEqual(token, self.client.cookies.get(COOKIE))
        self.assertEqual(self.client.post("/api/auth/register", json={
            "email": "one@example.com", "name": "Duplicate", "password": "OnlyForTests123!",
        }).status_code, 409)

    def test_profile_chats_and_results_survive_new_connection_and_login(self):
        self.register()
        profile = self.client.get("/api/account").json()["profile"]
        profile.update(name="Updated Name", address="Fictional test address", ageYears=42,
                       medicalHistory="Test allergy", pregnant=True, immunocompromised=True)
        self.assertEqual(self.client.put("/api/account/profile", json=profile).status_code, 200)
        chat = self.chat()
        response = self.client.put("/api/account/chats/" + chat["id"], json=chat)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["revision"], 1)
        self.client.post("/api/auth/logout")
        self.assertEqual(self.client.get("/api/account").status_code, 401)
        initialize_database()
        with TestClient(app) as fresh:
            response = fresh.post("/api/auth/login", json={
                "email": "ONE@example.com", "password": "OnlyForTests123!",
            })
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["profile"], profile)
            saved = data["chats"][0]
            for key in ["messages", "recipient", "emergency", "location", "selectedCaregiverId"]:
                self.assertEqual(saved[key], chat[key])
            self.assertEqual(saved["result"]["care_type"], "emergency_112")
            self.assertIsNone(saved["result"]["follow_up_question"])
            self.assertNotIn("age_years", saved["patientContext"])
            self.assertEqual(saved["patientContext"]["vitals"]["oxygen_percent"], 88)
            self.assertEqual(fresh.get("/api/account").headers["cache-control"], "no-store")

    def test_account_isolation_and_chat_conflict(self):
        self.register()
        chat = self.chat()
        first = self.client.put("/api/account/chats/" + chat["id"], json=chat).json()
        self.assertEqual(self.client.put("/api/account/chats/" + chat["id"], json=chat).status_code, 409)
        first["messages"].append({"role": "assistant", "content": "Call emergency services."})
        self.assertEqual(self.client.put("/api/account/chats/" + chat["id"], json=first).status_code, 200)
        self.client.post("/api/auth/logout")
        self.register("two@example.com")
        self.assertEqual(self.client.get("/api/account").json()["chats"], [])
        self.assertEqual(self.client.put("/api/account/profile", json={
            "email": "one@example.com", "name": "Intruder",
        }).status_code, 422)
        self.assertEqual(self.client.put("/api/account/chats/" + chat["id"], json=chat).status_code, 200)
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM chats").fetchone()[0], 2)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM messages").fetchone()[0], 3)

    def test_invalid_data_rejected_and_import_is_explicit_and_idempotent(self):
        self.register()
        profile = self.client.get("/api/account").json()["profile"]
        chat = self.chat()
        invalid = {**chat, "patientContext": {"vitals": {"oxygen_percent": 150}}}
        self.assertEqual(self.client.put("/api/account/chats/" + chat["id"], json=invalid).status_code, 422)
        self.assertEqual(self.client.put("/api/account/chats/" + str(uuid.uuid4()), json=chat).status_code, 422)
        profile["name"] = "Imported demo name"
        payload = {"profile": profile, "chats": [chat]}
        for _ in range(2):
            response = self.client.post("/api/account/import-demo", json=payload)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(len(response.json()["chats"]), 1)
        self.assertEqual(self.client.get("/api/account").json()["profile"]["name"], "Imported demo name")

    def test_each_message_retains_its_context_and_full_assessment(self):
        self.register()
        chat = self.chat()
        chat["messages"] = [
            {"role": "user", "content": "Earlier reading", "patientContext": {
                "age_years": 42, "vitals": {"oxygen_percent": 88},
            }, "location": {"lat": 28.5, "lng": 77.2}},
            {"role": "assistant", "content": "Call 112.", "result": chat["result"]},
            {"role": "user", "content": "Another reading", "patientContext": {
                "age_years": 42, "vitals": {"oxygen_percent": 98},
            }},
        ]
        self.assertEqual(self.client.put("/api/account/chats/" + chat["id"], json=chat).status_code, 200)
        messages = self.client.get("/api/account").json()["chats"][0]["messages"]
        self.assertEqual(messages[0]["patientContext"]["vitals"]["oxygen_percent"], 88)
        self.assertEqual(messages[0]["location"]["lat"], 28.5)
        self.assertEqual(messages[2]["patientContext"]["vitals"]["oxygen_percent"], 98)
        self.assertIsNone(messages[1]["result"]["follow_up_question"])

    def test_bad_password_expired_and_revoked_sessions(self):
        self.register()
        token = self.client.cookies.get(COOKIE)
        self.assertEqual(self.client.post("/api/auth/login", json={
            "email": "one@example.com", "password": "wrong",
        }).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 204)
        self.client.cookies.set(COOKIE, token, path="/api")
        self.assertEqual(self.client.get("/api/account").status_code, 401)
        self.client.cookies.clear()
        self.client.post("/api/auth/login", json={"email": "one@example.com", "password": "OnlyForTests123!"})
        with connection() as db:
            db.execute("UPDATE sessions SET expires_at=?", (int(time.time()) - 1,))
        self.assertEqual(self.client.get("/api/account").status_code, 401)

    def test_origin_checks_and_persistent_rate_limit(self):
        self.assertEqual(self.client.post("/api/auth/logout", headers={
            "Origin": "http://127.0.0.1:5174",
        }).status_code, 204)
        self.assertEqual(self.client.post("/api/auth/logout", headers={
            "Origin": "http://127.0.0.1:5173",
        }).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/logout", headers={
            "Origin": "https://untrusted.example",
        }).status_code, 403)
        for _ in range(10):
            self.assertEqual(self.client.post("/api/auth/login", json={
                "email": "missing@example.com", "password": "wrong",
            }).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json={
            "email": "missing@example.com", "password": "wrong",
        }).status_code, 429)


if __name__ == "__main__":
    unittest.main()
